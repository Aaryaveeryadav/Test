import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TutorScope } from '@/lib/ai/tutor'
import type { Profile } from '@/lib/types'

// ---------------------------------------------------------------------------
// Student context
// ---------------------------------------------------------------------------

export interface StudentContext {
  schoolId: string
  schoolName: string
  boardName: string
  boardCode: string
  grade: number
  schoolClassId: string
  className: string
  section: string
  academicYear: string
  subjects: { id: string; name: string; code: string }[]
}

export async function getStudentContext(profile: Profile): Promise<StudentContext | null> {
  const admin = createAdminClient()
  const { data: enr } = await admin
    .from('enrollments')
    .select(
      `school_class_id, school_classes!inner(
        id, section, academic_year, school_id,
        schools(name, status),
        classes(id, grade, label, boards(name, code))
      )`
    )
    .eq('student_id', profile.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!enr?.school_classes) return null
  const sc = enr.school_classes as unknown as {
    id: string
    section: string
    academic_year: string
    school_id: string
    schools: { name: string; status: string }
    classes: { id: string; grade: number; label: string | null; boards: { name: string; code: string } | null }
  }

  if (sc.schools.status !== 'active') return null

  const { data: cs } = await admin
    .from('class_subjects')
    .select('subjects(id, name, code, status)')
    .eq('school_class_id', sc.id)

  const subjects = (cs ?? [])
    .map((row) => row.subjects as unknown as { id: string; name: string; code: string; status: string })
    .filter((s) => s && s.status === 'active')
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    schoolId: sc.school_id,
    schoolName: sc.schools.name,
    boardName: sc.classes.boards?.name ?? '—',
    boardCode: sc.classes.boards?.code ?? '',
    grade: sc.classes.grade,
    schoolClassId: sc.id,
    className: sc.classes.label ?? `Class ${sc.classes.grade}`,
    section: sc.section,
    academicYear: sc.academic_year,
    subjects
  }
}

// ---------------------------------------------------------------------------
// Teacher assignments
// ---------------------------------------------------------------------------

export interface TeacherAssignment {
  id: string
  schoolClassId: string
  subjectId: string
  className: string
  section: string
  grade: number
  subjectName: string
  academicYear: string
  schoolId: string
}

export async function getTeacherAssignments(profile: Profile): Promise<TeacherAssignment[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('teacher_assignments')
    .select(
      `id, school_id, school_class_id, subject_id,
       school_classes(id, section, academic_year, classes(grade, label)),
       subjects(name)`
    )
    .eq('teacher_id', profile.id)
    .order('created_at')

  return (data ?? []).map((row) => {
    const sc = row.school_classes as unknown as {
      id: string
      section: string
      academic_year: string
      classes: { grade: number; label: string | null } | null
    }
    return {
      id: row.id,
      schoolClassId: row.school_class_id,
      subjectId: row.subject_id,
      className: sc?.classes?.label ?? `Class ${sc?.classes?.grade ?? ''}`,
      section: sc?.section ?? '',
      grade: sc?.classes?.grade ?? 0,
      subjectName: (row.subjects as unknown as { name: string } | null)?.name ?? '',
      academicYear: sc?.academic_year ?? '',
      schoolId: row.school_id
    }
  })
}

/** Verify a teacher really teaches this class+subject before showing data. */
export async function requireTeacherAssignment(
  profile: Profile,
  assignmentId: string
): Promise<TeacherAssignment | null> {
  const all = await getTeacherAssignments(profile)
  return all.find((a) => a.id === assignmentId) ?? null
}

// ---------------------------------------------------------------------------
// Curriculum helpers
// ---------------------------------------------------------------------------

export interface ChapterWithTopics {
  id: string
  number: number
  title: string
  topics: { id: string; title: string; description: string | null }[]
}

export async function getSubjectChapters(subjectId: string): Promise<ChapterWithTopics[]> {
  const admin = createAdminClient()
  const { data: chapters } = await admin
    .from('chapters')
    .select('id, number, title, status, topics(id, title, description, status)')
    .eq('subject_id', subjectId)
    .order('number')

  return (chapters ?? [])
    .filter((c) => c.status === 'active')
    .map((c) => ({
      id: c.id,
      number: c.number,
      title: c.title,
      topics: ((c.topics ?? []) as { id: string; title: string; description: string | null; status: string }[])
        .filter((t) => t.status === 'active')
        .map((t) => ({ id: t.id, title: t.title, description: t.description }))
    }))
}

export async function getTopicOverrideMap(
  schoolClassId: string,
  subjectId: string
): Promise<Map<string, 'included' | 'excluded' | 'emphasized'>> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('topic_overrides')
    .select('topic_id, state')
    .eq('school_class_id', schoolClassId)
    .eq('subject_id', subjectId)
  return new Map((data ?? []).map((row) => [row.topic_id, row.state]))
}

export async function getSchoolSettings(schoolId: string): Promise<{ ranking_enabled: boolean; retention_days: number }> {
  const admin = createAdminClient()
  const { data } = await admin.from('schools').select('settings').eq('id', schoolId).maybeSingle()
  const s = (data?.settings ?? {}) as Record<string, unknown>
  return {
    ranking_enabled: Boolean(s.ranking_enabled),
    retention_days: typeof s.retention_days === 'number' ? s.retention_days : 90
  }
}

// ---------------------------------------------------------------------------
// Tutor scope (validates student access and builds the TutorScope)
// ---------------------------------------------------------------------------

export async function getTutorScope(
  profile: Profile,
  subjectId: string,
  chapterId: string | null
): Promise<TutorScope | null> {
  const ctx = await getStudentContext(profile)
  if (!ctx) return null
  const subject = ctx.subjects.find((s) => s.id === subjectId)
  if (!subject) return null // subject not enabled for this student

  const chapters = await getSubjectChapters(subjectId)
  let chapter: ChapterWithTopics | null = null
  if (chapterId) {
    chapter = chapters.find((c) => c.id === chapterId) ?? null
    if (!chapter) return null // chapter not in this subject
  }

  const overrides = await getTopicOverrideMap(ctx.schoolClassId, subjectId)
  const relevantChapters = chapter ? [chapter] : chapters
  const allowedTopics = relevantChapters.flatMap((c) =>
    c.topics
      .filter((t) => overrides.get(t.id) !== 'excluded')
      .map((t) => ({ id: t.id, title: t.title, emphasized: overrides.get(t.id) === 'emphasized' }))
  )
  const excludedTopicIds = relevantChapters.flatMap((c) =>
    c.topics.filter((t) => overrides.get(t.id) === 'excluded').map((t) => t.id)
  )

  return {
    schoolId: ctx.schoolId,
    schoolName: ctx.schoolName,
    boardName: ctx.boardName,
    grade: ctx.grade,
    subjectId,
    subjectName: subject.name,
    chapterId: chapter?.id ?? null,
    chapterTitle: chapter?.title ?? null,
    chapterNumber: chapter?.number ?? null,
    allowedTopics,
    excludedTopicIds,
    hasAnyEnabledTopic: allowedTopics.length > 0 || (chapters.some((c) => c.topics.length > 0) && chapter === null)
  }
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export async function getSubjectLabel(subjectId: string): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('subjects')
    .select('name, code, classes(grade, boards(name))')
    .eq('id', subjectId)
    .maybeSingle()
  if (!data) return 'Subject'
  const cls = data.classes as unknown as { grade: number; boards: { name: string } | null } | null
  return `${cls?.boards?.name ?? ''} Class ${cls?.grade ?? ''} · ${data.name}`
}
