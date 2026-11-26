'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { getStudentContext, getTopicOverrideMap } from '@/lib/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { bool, num, optStr, str } from '@/lib/form'
import type { ActionState } from '@/lib/types'

/** Student flags an AI answer for teacher review. */
export async function flagMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('student')
  const messageId = str(formData, 'message_id')
  const note = optStr(formData, 'flag_note') ?? ''
  if (!messageId) return { error: 'Missing message.' }

  const admin = createAdminClient()
  const { data: msg } = await admin
    .from('messages')
    .select('id, chat_id, chats(student_id)')
    .eq('id', messageId)
    .maybeSingle()
  const chatStudent = (msg?.chats as unknown as { student_id: string } | null)?.student_id
  if (!msg || chatStudent !== profile.id) return { error: 'Message not found.' }

  await admin
    .from('messages')
    .update({ flag_status: 'flagged', flag_note: note || null })
    .eq('id', messageId)
  revalidatePath('/student/tutor')
  return { success: 'Thanks — this answer was sent to your teacher for review.' }
}

/** Student deletes one of their own chats (data minimisation). */
export async function deleteChat(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('student')
  const chatId = str(formData, 'chat_id')
  if (!chatId) return { error: 'Missing chat.' }
  const admin = createAdminClient()
  await admin.from('chats').delete().eq('id', chatId).eq('student_id', profile.id)
  revalidatePath('/student/tutor')
  return { success: 'Chat deleted.' }
}

/**
 * Record a practice attempt. Progress comes from these recorded attempts —
 * never from chat.
 */
export async function saveAttempt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('student')
  const subjectId = str(formData, 'subject_id')
  const chapterId = optStr(formData, 'chapter_id')
  const topicId = optStr(formData, 'topic_id')
  const source = str(formData, 'source') || 'pyq'
  const questionRef = optStr(formData, 'question_ref')
  const correct = bool(formData, 'correct')
  if (!subjectId) return { error: 'Missing subject.' }

  const ctx = await getStudentContext(profile)
  if (!ctx || !ctx.subjects.some((s) => s.id === subjectId)) {
    return { error: 'This subject is not enabled for you.' }
  }

  // Guard: topic must not be excluded by the teacher.
  if (topicId) {
    const overrides = await getTopicOverrideMap(ctx.schoolClassId, subjectId)
    if (overrides.get(topicId) === 'excluded') {
      return { error: 'This topic is not included for your class.' }
    }
  }

  const admin = createAdminClient()
  await admin.from('practice_attempts').insert({
    student_id: profile.id,
    subject_id: subjectId,
    chapter_id: chapterId,
    topic_id: topicId,
    source: ['pyq', 'teacher_question', 'self'].includes(source) ? source : 'pyq',
    question_ref: questionRef
      ? questionRef.slice(0, 200)
      : null,
    correct
  })
  revalidatePath('/student/progress')
  revalidatePath('/student')
  return { success: correct ? 'Recorded — well done! ✅' : 'Recorded — keep practising this topic. 💪' }
}

/** Submit an assignment/quiz. MCQs auto-grade; subjective answers go to the teacher. */
export async function submitAssignment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('student')
  const assignmentId = str(formData, 'assignment_id')
  if (!assignmentId) return { error: 'Missing assignment.' }

  const admin = createAdminClient()
  const { data: assignment } = await admin
    .from('assignments')
    .select('id, school_class_id, school_id, status')
    .eq('id', assignmentId)
    .maybeSingle()
  if (!assignment) return { error: 'Assignment not found.' }
  if (assignment.status !== 'open') return { error: 'This assignment is closed.' }

  const { data: enr } = await admin
    .from('enrollments')
    .select('id')
    .eq('student_id', profile.id)
    .eq('school_class_id', assignment.school_class_id)
    .eq('status', 'active')
    .maybeSingle()
  if (!enr) return { error: 'You are not enrolled in this class.' }

  const { data: existing } = await admin
    .from('submissions')
    .select('id')
    .eq('assignment_id', assignmentId)
    .eq('student_id', profile.id)
    .maybeSingle()
  if (existing) return { error: 'You have already submitted this assignment.' }

  const { data: questions } = await admin
    .from('assignment_questions')
    .select('id, kind, options, correct_option, marks, topic_id')
    .eq('assignment_id', assignmentId)
    .order('position')

  let score = 0
  let totalMarks = 0
  let hasSubjective = false
  const answers: {
    question_id: string
    answer_text: string | null
    selected_option: number | null
    correct: boolean | null
    marks_awarded: number | null
  }[] = []
  const attempts: {
    student_id: string
    subject_id: string
    chapter_id: string | null
    topic_id: string | null
    source: string
    question_ref: string
    correct: boolean
  }[] = []

  const { data: subj } = await admin
    .from('assignments')
    .select('subject_id')
    .eq('id', assignmentId)
    .maybeSingle()

  for (const q of questions ?? []) {
    totalMarks += q.marks ?? 1
    if (q.kind === 'mcq') {
      const raw = str(formData, `question_${q.id}`)
      const selected = raw === '' ? null : Number(raw)
      const correct = selected !== null && selected === (q.correct_option ?? -1)
      const awarded = correct ? (q.marks ?? 1) : 0
      score += awarded
      answers.push({
        question_id: q.id,
        answer_text: null,
        selected_option: selected,
        correct,
        marks_awarded: awarded
      })
      if (q.topic_id && selected !== null && subj) {
        attempts.push({
          student_id: profile.id,
          subject_id: subj.subject_id,
          chapter_id: null,
          topic_id: q.topic_id,
          source: 'assignment',
          question_ref: q.id,
          correct
        })
      }
    } else {
      hasSubjective = true
      answers.push({
        question_id: q.id,
        answer_text: optStr(formData, `question_${q.id}`) ?? '',
        selected_option: null,
        correct: null,
        marks_awarded: null
      })
    }
  }

  const { data: submission, error: subErr } = await admin
    .from('submissions')
    .insert({
      assignment_id: assignmentId,
      student_id: profile.id,
      status: hasSubjective ? 'submitted' : 'graded',
      score: hasSubjective ? null : score,
      graded_at: hasSubjective ? null : new Date().toISOString()
    })
    .select('id')
    .single()
  if (subErr || !submission) return { error: 'Could not save your submission. Please try again.' }

  await admin.from('submission_answers').insert(answers.map((a) => ({ ...a, submission_id: submission.id })))
  if (attempts.length > 0) await admin.from('practice_attempts').insert(attempts)

  revalidatePath('/student/assignments')
  revalidatePath('/student/progress')
  return {
    success: hasSubjective
      ? 'Submitted! Your teacher will review the written answers.'
      : `Submitted! Auto-scored: ${score}/${totalMarks}.`
  }
}
