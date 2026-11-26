'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { audit } from '@/lib/audit'
import { num, optStr, str } from '@/lib/form'
import { syncNoteChunk, removeNoteChunk } from '@/lib/rag-sync'
import type { ActionState } from '@/lib/types'

/** Teacher marks a topic included / excluded / emphasized for ONE class only. */
export async function setTopicOverride(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('teacher')
  const schoolClassId = str(formData, 'school_class_id')
  const subjectId = str(formData, 'subject_id')
  const topicId = str(formData, 'topic_id')
  const state = str(formData, 'state')
  if (!schoolClassId || !subjectId || !topicId) return { error: 'Missing topic information.' }

  // Verify this teacher actually teaches this class+subject.
  const admin = createAdminClient()
  const { data: owns } = await admin
    .from('teacher_assignments')
    .select('id')
    .eq('teacher_id', profile.id)
    .eq('school_class_id', schoolClassId)
    .eq('subject_id', subjectId)
    .maybeSingle()
  if (!owns) return { error: 'You are not assigned to this class and subject.' }

  if (state === 'reset') {
    await admin
      .from('topic_overrides')
      .delete()
      .eq('school_class_id', schoolClassId)
      .eq('topic_id', topicId)
  } else if (['included', 'excluded', 'emphasized'].includes(state)) {
    const { data: sc } = await admin
      .from('school_classes')
      .select('school_id')
      .eq('id', schoolClassId)
      .maybeSingle()
    await admin.from('topic_overrides').upsert(
      {
        school_class_id: schoolClassId,
        subject_id: subjectId,
        topic_id: topicId,
        teacher_id: profile.id,
        school_id: (sc?.school_id as string) ?? profile.school_id,
        state,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'school_class_id,topic_id' }
    )
    await audit({
      actorId: profile.id,
      schoolId: profile.school_id,
      action: `topics.${state}`,
      entity: 'topic_overrides',
      entityId: topicId,
      details: { school_class_id: schoolClassId, subject_id: subjectId, state }
    })
  } else {
    return { error: 'Invalid state.' }
  }

  revalidatePath('/teacher/topics')
  revalidatePath('/teacher')
  return { success: 'Topic list updated for this class. (Master curriculum unchanged.)' }
}

/** Create or update a class-specific note / practice question. */
export async function upsertNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('teacher')
  const noteId = optStr(formData, 'note_id')
  const assignmentId = str(formData, 'assignment_id')
  const chapterId = optStr(formData, 'chapter_id')
  const topicId = optStr(formData, 'topic_id')
  const kind = str(formData, 'kind') === 'practice_question' ? 'practice_question' : 'note'
  const title = str(formData, 'title')
  const body = str(formData, 'body')
  const publish = str(formData, 'publish') === '1'

  if (title.length < 3) return { error: 'Title is too short.' }
  if (body.length < 3) return { error: 'Content is too short.' }

  const admin = createAdminClient()
  const { data: owns } = await admin
    .from('teacher_assignments')
    .select('id, school_id, school_class_id, subject_id')
    .eq('teacher_id', profile.id)
    .eq('id', assignmentId)
    .maybeSingle()
  if (!owns) return { error: 'You are not assigned to this class and subject.' }
  const schoolClassId = owns.school_class_id
  const subjectId = owns.subject_id

  const payload = {
    school_class_id: schoolClassId,
    subject_id: subjectId,
    chapter_id: chapterId,
    topic_id: topicId,
    kind,
    title,
    body,
    status: publish ? ('published' as const) : ('draft' as const)
  }

  let saved: { id: string } | null = null
  if (noteId) {
    const { data } = await admin
      .from('school_notes')
      .update(payload)
      .eq('id', noteId)
      .eq('author_id', profile.id)
      .select('id')
      .single()
    saved = data
  } else {
    const { data } = await admin
      .from('school_notes')
      .insert({ ...payload, school_id: owns.school_id, author_id: profile.id })
      .select('id')
      .single()
    saved = data
  }
  if (!saved) return { error: 'Could not save the note.' }

  // Published notes/practice questions become searchable school-scoped material.
  if (payload.status === 'published') {
    await syncNoteChunk({
      id: saved.id,
      school_id: owns.school_id,
      subject_id: subjectId,
      chapter_id: chapterId,
      topic_id: topicId,
      kind,
      title,
      body
    })
  } else {
    await removeNoteChunk(saved.id)
  }

  await audit({
    actorId: profile.id,
    schoolId: profile.school_id,
    action: 'notes.upsert',
    entity: 'school_notes',
    entityId: saved.id,
    details: { kind, published: payload.status === 'published' }
  })

  revalidatePath('/teacher/notes')
  return { success: publish ? 'Saved and published — students and the tutor can see it.' : 'Saved as draft.' }
}

export async function archiveNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('teacher')
  const noteId = str(formData, 'note_id')
  const admin = createAdminClient()
  const { data } = await admin
    .from('school_notes')
    .update({ status: 'archived' })
    .eq('id', noteId)
    .eq('author_id', profile.id)
    .select('id')
    .single()
  if (data) await removeNoteChunk(noteId)
  revalidatePath('/teacher/notes')
  return { success: 'Note archived.' }
}

/** Create an assignment/quiz for one of the teacher's classes. */
export async function createAssignment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('teacher')
  const assignmentId = str(formData, 'assignment_id')
  const title = str(formData, 'title')
  const description = optStr(formData, 'description')
  const dueAt = optStr(formData, 'due_at')

  if (title.length < 3) return { error: 'Title is too short.' }
  const admin = createAdminClient()
  const { data: owns } = await admin
    .from('teacher_assignments')
    .select('id, school_id, school_class_id, subject_id')
    .eq('teacher_id', profile.id)
    .eq('id', assignmentId)
    .maybeSingle()
  if (!owns) return { error: 'You are not assigned to this class and subject.' }
  const schoolClassId = owns.school_class_id
  const subjectId = owns.subject_id

  const { error } = await admin.from('assignments').insert({
    school_id: owns.school_id,
    school_class_id: schoolClassId,
    subject_id: subjectId,
    created_by: profile.id,
    title,
    description,
    due_at: dueAt
  })
  if (error) return { error: 'Could not create the assignment.' }
  revalidatePath('/teacher/assignments')
  return { success: 'Assignment created. Now add questions from the assignments list.' }
}

export async function setAssignmentStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('teacher')
  const assignmentId = str(formData, 'assignment_id')
  const status = str(formData, 'status') === 'closed' ? 'closed' : 'open'
  const admin = createAdminClient()
  await admin
    .from('assignments')
    .update({ status })
    .eq('id', assignmentId)
    .eq('created_by', profile.id)
  revalidatePath('/teacher/assignments')
  revalidatePath(`/teacher/assignments/${assignmentId}`)
  return { success: status === 'closed' ? 'Assignment closed.' : 'Assignment re-opened.' }
}

/** Add a question (MCQ auto-graded or subjective, teacher-reviewed). */
export async function addQuestion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('teacher')
  const assignmentId = str(formData, 'assignment_id')
  const kind = str(formData, 'kind') === 'subjective' ? 'subjective' : 'mcq'
  const questionText = str(formData, 'question_text')
  const optionsRaw = str(formData, 'options')
  const correctOption = num(formData, 'correct_option')
  const marks = num(formData, 'marks') ?? 1
  const topicId = optStr(formData, 'topic_id')

  if (questionText.length < 5) return { error: 'Question text is too short.' }
  if (kind === 'mcq') {
    const opts = optionsRaw.split('\n').map((s) => s.trim()).filter(Boolean)
    if (opts.length < 2 || opts.length > 6) return { error: 'MCQ needs 2–6 options (one per line).' }
    if (correctOption === null || correctOption < 1 || correctOption > opts.length) {
      return { error: 'Correct option must be a number between 1 and the number of options.' }
    }
  }

  const admin = createAdminClient()
  const { data: assignment } = await admin
    .from('assignments')
    .select('id, created_by, subject_id')
    .eq('id', assignmentId)
    .eq('created_by', profile.id)
    .maybeSingle()
  if (!assignment) return { error: 'Assignment not found.' }

  const { data: count } = await admin
    .from('assignment_questions')
    .select('id', { count: 'exact', head: true })
    .eq('assignment_id', assignmentId)

  const { error } = await admin.from('assignment_questions').insert({
    assignment_id: assignmentId,
    topic_id: topicId,
    kind,
    question_text: questionText,
    options:
      kind === 'mcq'
        ? optionsRaw.split('\n').map((s) => s.trim()).filter(Boolean)
        : null,
    correct_option: kind === 'mcq' ? (correctOption ?? 1) - 1 : null,
    marks: Math.min(Math.max(marks, 1), 100),
    position: (count ?? 0) as number
  })
  if (error) return { error: 'Could not add the question.' }
  revalidatePath(`/teacher/assignments/${assignmentId}`)
  return { success: 'Question added.' }
}

/** Grade the subjective answers of a submission. */
export async function gradeSubmission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('teacher')
  const submissionId = str(formData, 'submission_id')
  const feedback = optStr(formData, 'feedback')

  const admin = createAdminClient()
  const { data: submission } = await admin
    .from('submissions')
    .select('id, assignment_id, status, assignments!inner(id, created_by)')
    .eq('id', submissionId)
    .maybeSingle()
  const createdBy = (submission?.assignments as unknown as { created_by: string } | null)?.created_by
  if (!submission || createdBy !== profile.id) return { error: 'Submission not found.' }

  const { data: answers } = await admin
    .from('submission_answers')
    .select('id, question_id, submission_answers_correct:correct, marks_awarded')
    .eq('submission_id', submissionId)
  const { data: questions } = await admin
    .from('assignment_questions')
    .select('id, marks')
    .eq('assignment_id', submission.assignment_id)
  const marksMap = new Map((questions ?? []).map((q) => [q.id, q.marks ?? 1]))

  let total = 0
  for (const a of answers ?? []) {
    const qid = a.question_id
    const isSubjective = a.marks_awarded === null && a.submission_answers_correct === null
    let awarded = a.marks_awarded
    if (isSubjective) {
      const raw = num(formData, `marks_${a.id}`)
      if (raw === null) continue
      awarded = Math.min(Math.max(raw, 0), marksMap.get(qid) ?? 0)
    }
    if (typeof awarded === 'number') total += awarded
    await admin.from('submission_answers').update({ marks_awarded: awarded }).eq('id', a.id)
  }

  await admin
    .from('submissions')
    .update({ status: 'graded', score: total, feedback, graded_by: profile.id, graded_at: new Date().toISOString() })
    .eq('id', submissionId)
  await audit({
    actorId: profile.id,
    schoolId: profile.school_id,
    action: 'assignments.graded',
    entity: 'submissions',
    entityId: submissionId,
    details: { score: total }
  })

  revalidatePath(`/teacher/assignments/${submission.assignment_id}`)
  return { success: `Graded. Total score: ${total}.` }
}

/** Teacher resolves a flagged AI answer after review. */
export async function resolveFlag(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('teacher')
  const messageId = str(formData, 'message_id')
  const reviewNote = optStr(formData, 'review_note')

  const admin = createAdminClient()
  const { data: msg } = await admin
    .from('messages')
    .select('id, chat_id, chats!inner(student_id, school_class_id, subject_id)')
    .eq('id', messageId)
    .eq('flag_status', 'flagged')
    .maybeSingle()
  const chat = msg?.chats as unknown as { student_id: string; school_class_id: string; subject_id: string } | null
  if (!msg || !chat) return { error: 'Flagged message not found.' }

  // Verify the teacher teaches this student's class + subject.
  const { data: owns } = await admin
    .from('teacher_assignments')
    .select('id')
    .eq('teacher_id', profile.id)
    .eq('school_class_id', chat.school_class_id)
    .eq('subject_id', chat.subject_id)
    .maybeSingle()
  if (!owns) return { error: 'This question belongs to a class you do not teach.' }

  await admin
    .from('messages')
    .update({ flag_status: 'resolved', review_note: reviewNote })
    .eq('id', messageId)
  revalidatePath('/teacher/review')
  return { success: 'Flag resolved.' }
}
