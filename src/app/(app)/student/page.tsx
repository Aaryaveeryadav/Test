import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { getStudentContext } from '@/lib/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { subjectProgress } from '@/lib/progress'
import { Card, CardTitle, EmptyState, MasteryBadge, PageHeader, ProgressBar, StatCard } from '@/components/ui'
import { formatDateTime, truncate } from '@/lib/utils'

export const metadata = { title: 'Student dashboard' }

export default async function StudentDashboard() {
  const profile = await requireRole('student')
  const ctx = await getStudentContext(profile)
  if (!ctx) {
    return (
      <>
        <PageHeader title="Welcome!" />
        <EmptyState
          title="Your class and subjects are not set up yet"
          hint="Your school administrator needs to enroll you in a class. Please check back after they confirm, or contact your school office."
        />
      </>
    )
  }

  const admin = createAdminClient()
  const [{ data: attempts }, { data: chats }, { data: assignments }] = await Promise.all([
    admin
      .from('practice_attempts')
      .select('subject_id, topic_id, correct, created_at')
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(500),
    admin
      .from('chats')
      .select('id, title, subject_id, last_message_at')
      .eq('student_id', profile.id)
      .order('last_message_at', { ascending: false })
      .limit(5),
    admin
      .from('assignments')
      .select('id, title, due_at, status, subject_id, subjects(name), submissions(score, status)')
      .eq('school_class_id', ctx.schoolClassId)
      .eq('status', 'open')
      .order('due_at', { ascending: true })
      .limit(6)
  ])

  const attemptsBySubject = new Map<string, { correct: boolean; topic_id: string | null; created_at: string }[]>()
  for (const a of attempts ?? []) {
    const list = attemptsBySubject.get(a.subject_id) ?? []
    list.push(a)
    attemptsBySubject.set(a.subject_id, list)
  }

  return (
    <>
      <PageHeader
        title={`Hi ${profile.full_name.split(' ')[0]} 👋`}
        subtitle={`${ctx.schoolName} · ${ctx.boardName} · ${ctx.className} ${ctx.section} · ${ctx.academicYear}`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Subjects" value={ctx.subjects.length} hint="Enabled by your school" />
        <StatCard label="Practice attempts" value={attempts?.length ?? 0} hint="Recorded practice + assignments" />
        <StatCard label="Open assignments" value={assignments?.length ?? 0} hint="Due soon" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle
            right={
              <Link href="/student/tutor" className="text-sm font-semibold text-indigo-600 hover:underline">
                Ask the tutor →
              </Link>
            }
          >
            My subjects
          </CardTitle>
          {ctx.subjects.length === 0 ? (
            <EmptyState title="No subjects enabled yet" hint="Your school will add subjects to your class soon." />
          ) : (
            <ul className="space-y-3">
              {ctx.subjects.map((s) => {
                const pct = subjectProgress(attemptsBySubject.get(s.id) ?? [])
                return (
                  <li key={s.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/student/subject/${s.id}`} className="font-semibold text-slate-800 hover:text-indigo-600">
                        {s.name}
                      </Link>
                      <MasteryBadge pct={pct} />
                    </div>
                    <div className="mt-2">
                      <ProgressBar pct={pct} />
                    </div>
                    <div className="mt-2 flex gap-3 text-xs">
                      <Link href={`/student/tutor?subject=${s.id}`} className="font-medium text-indigo-600 hover:underline">
                        Ask tutor
                      </Link>
                      <Link href={`/student/practice?subject=${s.id}`} className="font-medium text-indigo-600 hover:underline">
                        Practice
                      </Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>Recent questions</CardTitle>
            {chats?.length ? (
              <ul className="divide-y">
                {chats.map((c) => (
                  <li key={c.id} className="py-2">
                    <Link href={`/student/tutor/${c.id}`} className="text-sm font-medium text-slate-700 hover:text-indigo-600">
                      {truncate(c.title, 60)}
                    </Link>
                    <p className="text-xs text-slate-400">{formatDateTime(c.last_message_at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No questions yet. Try asking the tutor about a topic you are studying.</p>
            )}
          </Card>

          <Card>
            <CardTitle
              right={
                <Link href="/student/assignments" className="text-sm font-semibold text-indigo-600 hover:underline">
                  All assignments →
                </Link>
              }
            >
              Assignments due
            </CardTitle>
            {assignments?.length ? (
              <ul className="space-y-2">
                {assignments.map((a) => {
                  const subj = (a.subjects as unknown as { name: string } | null)?.name ?? ''
                  const sub = (a.submissions as unknown as { score: number | null; status: string }[] | null)?.[0]
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link href={`/student/assignments/${a.id}`} className="font-medium text-slate-700 hover:text-indigo-600">
                        {truncate(a.title, 46)} <span className="text-slate-400">· {subj}</span>
                      </Link>
                      <span className="shrink-0 text-xs text-slate-500">
                        {sub ? (sub.status === 'graded' ? `Scored ${sub.score}` : 'Submitted') : a.due_at ? formatDateTime(a.due_at) : 'Open'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Nothing due right now. 🎉</p>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardTitle>How your progress is calculated</CardTitle>
        <p className="text-sm text-slate-600">
          Progress comes only from your recorded practice attempts and assignment results — never from your chats with
          the tutor. Keep practising: each attempt updates your topic mastery.
        </p>
      </Card>
    </>
  )
}
