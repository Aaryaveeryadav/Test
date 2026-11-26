import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { getSubjectChapters, getTopicOverrideMap, requireTeacherAssignment } from '@/lib/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSchoolSettings } from '@/lib/data'
import { attentionTopics, computeTopicProgress } from '@/lib/progress'
import { BackLink, Card, CardTitle, EmptyState, MasteryBadge, PageHeader, ProgressBar, StatCard, Th, Td } from '@/components/ui'
import { formatDateTime, truncate } from '@/lib/utils'

export const metadata = { title: 'Class dashboard' }

export default async function ClassDashboard({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params
  const profile = await requireRole('teacher')
  const assignment = await requireTeacherAssignment(profile, assignmentId)
  if (!assignment) notFound()

  const admin = createAdminClient()
  const [{ data: students }, { data: attempts }, settings, chapters] = await Promise.all([
    admin
      .from('enrollments')
      .select('student_id, profiles(id, full_name, roll_number, status)')
      .eq('school_class_id', assignment.schoolClassId)
      .eq('status', 'active'),
    admin
      .from('practice_attempts')
      .select('student_id, topic_id, correct, created_at')
      .eq('subject_id', assignment.subjectId)
      .limit(2000),
    getSchoolSettings(assignment.schoolId),
    getSubjectChapters(assignment.subjectId)
  ])

  const { data: assignments } = await admin
    .from('assignments')
    .select('id, title, due_at, status, submissions(count)')
    .eq('school_class_id', assignment.schoolClassId)
    .eq('subject_id', assignment.subjectId)
    .eq('created_by', profile.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: flagged } = await admin
    .from('messages')
    .select('id, flag_note, chats!inner(student_id, school_class_id, subject_id)')
    .eq('flag_status', 'flagged')
    .eq('chats.school_class_id', assignment.schoolClassId)
    .eq('chats.subject_id', assignment.subjectId)
    .limit(50)

  const studentRows = (students ?? []).filter(
    (s) => (s.profiles as unknown as { status: string } | null)?.status === 'active'
  )
  const studentIds = new Set(studentRows.map((s) => s.student_id))
  const classAttempts = (attempts ?? []).filter((a) => studentIds.has(a.student_id))
  const classProgress = computeTopicProgress(classAttempts.map((a) => ({ topic_id: a.topic_id, correct: a.correct, created_at: a.created_at })))

  const perStudent = studentRows.map((s) => {
    const mine = classAttempts.filter((a) => a.student_id === s.student_id)
    const p = computeTopicProgress(mine.map((a) => ({ topic_id: a.topic_id, correct: a.correct, created_at: a.created_at })))
    const values = Object.values(p).filter((v) => v.attempts > 0)
    const avg = values.length ? Math.round(values.reduce((sum, v) => sum + (v.pct ?? 0), 0) / values.length) : null
    return {
      id: s.student_id,
      name: (s.profiles as unknown as { full_name: string } | null)?.full_name ?? '—',
      roll: (s.profiles as unknown as { roll_number: string | null } | null)?.roll_number ?? '—',
      attempts: mine.length,
      avg
    }
  })

  const allTopics = chapters.flatMap((c) => c.topics.map((t) => ({ ...t, chapter: c.title })))
  const overrides = await getTopicOverrideMap(assignment.schoolClassId, assignment.subjectId)
  const attention = attentionTopics(allTopics, classProgress)

  return (
    <>
      <BackLink href="/teacher">All my classes</BackLink>
      <PageHeader
        title={`${assignment.subjectName} · Class ${assignment.grade} ${assignment.className} ${assignment.section}`}
        subtitle="Topic-level practice results and progress over time. Progress comes only from recorded practice and assignment results."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Students" value={studentRows.length} />
        <StatCard label="Recorded attempts" value={classAttempts.length} hint="practice + assignments" />
        <StatCard label="Flagged answers" value={flagged?.length ?? 0} hint="awaiting your review" />
        <StatCard label="Assignments" value={assignments?.length ?? 0} hint="created by you" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle
            right={
              <Link href="/teacher/review" className="text-sm font-semibold text-rose-600 hover:underline">
                Review flags →
              </Link>
            }
          >
            Students
          </CardTitle>
          <table className="w-full">
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Roll</Th>
                <Th>Attempts</Th>
                <Th>Mastery</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {perStudent.map((s) => (
                <tr key={s.id}>
                  <Td className="font-medium">{s.name}</Td>
                  <Td>{s.roll}</Td>
                  <Td>{s.attempts}</Td>
                  <Td>
                    <div className="w-28">
                      <ProgressBar pct={s.avg} />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          {perStudent.length === 0 ? <EmptyState title="No students enrolled yet" /> : null}
        </Card>

        <Card>
          <CardTitle
            right={
              <Link href={`/teacher/topics?a=${assignment.id}`} className="text-sm font-semibold text-rose-600 hover:underline">
                Plan topics →
              </Link>
            }
          >
            Topics to watch
          </CardTitle>
          {attention.length > 0 ? (
            <ul className="space-y-2">
              {attention.map((t) => (
                <li key={t.title} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-slate-700">{t.title}</span>
                  <div className="flex w-40 items-center gap-2">
                    <ProgressBar pct={t.pct} />
                    <MasteryBadge pct={t.pct} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">
              Not enough recorded practice yet to highlight topics. Encourage students to use the practice section.
            </p>
          )}
          <p className="mt-3 text-xs text-amber-700">
            ⚠ Estimate based on recorded practice results — not a prediction or guarantee of exam performance.
          </p>
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle>Topic-level class results</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr>
                <Th>Topic</Th>
                <Th>Chapter</Th>
                <Th>Teacher plan</Th>
                <Th>Attempts</Th>
                <Th>Class mastery</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {allTopics.map((t) => {
                const p = classProgress[t.id]
                const state = overrides.get(t.id)
                return (
                  <tr key={t.id}>
                    <Td className="font-medium">{truncate(t.title, 40)}</Td>
                    <Td>{truncate(t.chapter, 28)}</Td>
                    <Td>
                      {state === 'emphasized' ? <span className="text-xs font-semibold text-amber-700">emphasized</span> : null}
                      {state === 'excluded' ? <span className="text-xs text-rose-600">excluded</span> : null}
                      {!state ? <span className="text-xs text-slate-400">included</span> : null}
                    </Td>
                    <Td>{p?.attempts ?? 0}</Td>
                    <Td>
                      <div className="w-28">
                        <ProgressBar pct={p?.pct ?? null} />
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {allTopics.length === 0 ? <EmptyState title="No topics in the master curriculum yet" /> : null}
      </Card>

      <Card className="mt-6">
        <CardTitle
          right={
            <Link href="/teacher/assignments" className="text-sm font-semibold text-rose-600 hover:underline">
              Manage assignments →
            </Link>
          }
        >
          Your assignments for this class
        </CardTitle>
        {assignments?.length ? (
          <ul className="space-y-2">
            {assignments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/teacher/assignments/${a.id}`} className="font-medium text-slate-700 hover:text-rose-600">
                  {truncate(a.title, 50)}
                </Link>
                <span className="text-xs text-slate-500">
                  {(a.submissions as unknown as { count: number }[] | null)?.[0]?.count ?? 0} submissions
                  {a.due_at ? ` · due ${formatDateTime(a.due_at)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No assignments created yet.</p>
        )}
      </Card>

      {settings.ranking_enabled ? (
        <Card className="mt-6">
          <CardTitle>Class ranking (enabled by your school)</CardTitle>
          <p className="mb-2 text-xs text-slate-500">
            Visible only to authorized staff of this class. Based on recorded attempts — not a measure of a student&apos;s worth.
          </p>
          <table className="w-full">
            <thead>
              <tr>
                <Th>Position</Th>
                <Th>Student</Th>
                <Th>Average mastery</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...perStudent]
                .filter((s) => s.avg !== null)
                .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
                .map((s, i) => (
                  <tr key={s.id}>
                    <Td>#{i + 1}</Td>
                    <Td>{s.name}</Td>
                    <Td>{s.avg}%</Td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </>
  )
}
