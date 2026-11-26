import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { getStudentContext } from '@/lib/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'

export const metadata = { title: 'Assignments' }

export default async function StudentAssignments() {
  const profile = await requireRole('student')
  const ctx = await getStudentContext(profile)
  if (!ctx) {
    return (
      <>
        <PageHeader title="Assignments" />
        <EmptyState title="No class set up yet" />
      </>
    )
  }

  const admin = createAdminClient()
  const { data: assignments } = await admin
    .from('assignments')
    .select('id, title, description, due_at, status, subject_id, subjects(name), submissions(id, status, score)')
    .eq('school_class_id', ctx.schoolClassId)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <>
      <PageHeader title="Assignments & quizzes" subtitle={`${ctx.className} ${ctx.section}`} />
      {assignments?.length ? (
        <div className="space-y-3">
          {assignments.map((a) => {
            const subj = (a.subjects as unknown as { name: string } | null)?.name ?? ''
            const sub = (a.submissions as unknown as { id: string; status: string; score: number | null }[] | null)?.[0]
            return (
              <Card key={a.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {a.title} <span className="text-sm font-normal text-slate-400">· {subj}</span>
                    </p>
                    {a.due_at ? <p className="text-xs text-slate-500">Due: {formatDateTime(a.due_at)}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {a.status === 'closed' ? <Badge tone="rose">Closed</Badge> : <Badge tone="green">Open</Badge>}
                    {sub ? (
                      sub.status === 'graded' ? (
                        <Badge tone="indigo">Scored: {sub.score}</Badge>
                      ) : (
                        <Badge tone="sky">Submitted — awaiting review</Badge>
                      )
                    ) : null}
                    <Link href={`/student/assignments/${a.id}`} className="btn-secondary">
                      {sub ? 'View' : 'Take assignment'}
                    </Link>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState title="No assignments yet" hint="Your teachers will post assignments and quizzes here." />
      )}
    </>
  )
}
