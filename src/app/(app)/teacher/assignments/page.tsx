import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { getTeacherAssignments } from '@/lib/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { ActionForm } from '@/components/action-form'
import { Badge, Card, CardTitle, EmptyState, PageHeader } from '@/components/ui'
import { createAssignment, setAssignmentStatus } from '@/actions/teacher-actions'
import { formatDateTime } from '@/lib/utils'

export const metadata = { title: 'Assignments' }

export default async function TeacherAssignmentsPage() {
  const profile = await requireRole('teacher')
  const assignments = await getTeacherAssignments(profile)

  if (assignments.length === 0) {
    return (
      <>
        <PageHeader title="Assignments & quizzes" />
        <EmptyState title="No class assignments yet" hint="You need a class-subject assignment before creating work." />
      </>
    )
  }

  const admin = createAdminClient()
  const { data: created } = await admin
    .from('assignments')
    .select('id, title, due_at, status, created_at, subjects(name), school_classes(section, classes(grade, label)), assignment_questions(count), submissions(count)')
    .eq('created_by', profile.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <>
      <PageHeader title="Assignments & quizzes" subtitle="MCQ questions auto-grade; written answers come to you for review." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Create assignment</CardTitle>
          <ActionForm action={createAssignment} submitLabel="Create">
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="assignment_id">
                  Class &amp; subject
                </label>
                <select id="assignment_id" name="assignment_id" className="input" required>
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      Class {a.grade} {a.className} {a.section} · {a.subjectName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="title">
                  Title
                </label>
                <input id="title" name="title" required maxLength={120} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="description">
                  Instructions (optional)
                </label>
                <textarea id="description" name="description" rows={3} maxLength={1000} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="due_at">
                  Due date &amp; time (optional)
                </label>
                <input id="due_at" name="due_at" type="datetime-local" className="input" />
              </div>
            </div>
          </ActionForm>
        </Card>

        <Card>
          <CardTitle>My assignments</CardTitle>
          {created?.length ? (
            <ul className="space-y-3">
              {created.map((a) => {
                const cls = a.school_classes as unknown as { section: string; classes: { grade: number; label: string | null } | null } | null
                return (
                  <li key={a.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Link href={`/teacher/assignments/${a.id}`} className="font-semibold text-slate-800 hover:text-indigo-600">
                          {a.title}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {(a.subjects as unknown as { name: string } | null)?.name} · Class {cls?.classes?.grade ?? ''}
                          {cls?.section ? ` ${cls.section}` : ''} · {(a.assignment_questions as unknown as { count: number }[] | null)?.[0]?.count ?? 0} questions ·{' '}
                          {(a.submissions as unknown as { count: number }[] | null)?.[0]?.count ?? 0} submissions
                          {a.due_at ? ` · due ${formatDateTime(a.due_at)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.status === 'open' ? <Badge tone="green">Open</Badge> : <Badge tone="rose">Closed</Badge>}
                        <ActionForm action={setAssignmentStatus} submitLabel={a.status === 'open' ? 'Close' : 'Re-open'} className="inline">
                          <input type="hidden" name="assignment_id" value={a.id} />
                          <input type="hidden" name="status" value={a.status === 'open' ? 'closed' : 'open'} />
                        </ActionForm>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No assignments yet — create one, then add questions.</p>
          )}
        </Card>
      </div>
    </>
  )
}
