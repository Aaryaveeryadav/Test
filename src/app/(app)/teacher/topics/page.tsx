import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { getSubjectChapters, getTeacherAssignments, getTopicOverrideMap } from '@/lib/data'
import { ActionForm } from '@/components/action-form'
import { Badge, Card, CardTitle, EmptyState, PageHeader } from '@/components/ui'
import { setTopicOverride } from '@/actions/teacher-actions'

export const metadata = { title: 'Topic planning' }

const ACTIONS = [
  { state: 'included', label: 'Include', variant: 'secondary' as const },
  { state: 'emphasized', label: 'Emphasize', variant: 'secondary' as const },
  { state: 'excluded', label: 'Exclude', variant: 'secondary' as const },
  { state: 'reset', label: 'Reset', variant: 'secondary' as const }
]

export default async function TopicsPage({
  searchParams
}: {
  searchParams: Promise<{ a?: string }>
}) {
  const params = await searchParams
  const profile = await requireRole('teacher')
  const assignments = await getTeacherAssignments(profile)

  if (assignments.length === 0) {
    return (
      <>
        <PageHeader title="Topic planning" />
        <EmptyState title="No class assignments yet" hint="Your school administrator needs to assign you to a class and subject first." />
      </>
    )
  }

  const current = assignments.find((a) => a.id === params.a) ?? assignments[0]
  const [chapters, overrides] = await Promise.all([
    getSubjectChapters(current.subjectId),
    getTopicOverrideMap(current.schoolClassId, current.subjectId)
  ])

  return (
    <>
      <PageHeader
        title="Topic planning"
        subtitle="Mark topics as included, excluded or emphasized for THIS class only. The master curriculum is never changed."
      />

      <Card className="mb-4">
        <form action="/teacher/topics" method="get" className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-slate-600" htmlFor="assignment">
            Class &amp; subject:
          </label>
          <select name="a" id="assignment" defaultValue={current.id} className="input max-w-md">
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                Class {a.grade} {a.className} {a.section} · {a.subjectName}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-secondary">
            Switch
          </button>
        </form>
      </Card>

      <p className="mb-4 text-sm text-slate-500">
        Emphasized topics are highlighted to students; excluded topics are hidden from their syllabus and ignored by
        the tutor.
      </p>

      {chapters.length === 0 ? (
        <EmptyState title="No chapters in the master curriculum for this subject yet" />
      ) : (
        <div className="space-y-4">
          {chapters.map((c) => (
            <Card key={c.id}>
              <CardTitle>
                Chapter {c.number}: {c.title}
              </CardTitle>
              {c.topics.length === 0 ? (
                <p className="text-sm text-slate-500">No topics.</p>
              ) : (
                <ul className="space-y-2">
                  {c.topics.map((t) => {
                    const state = overrides.get(t.id)
                    return (
                      <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-700">{t.title}</span>
                          {state === 'emphasized' ? <Badge tone="amber">emphasized</Badge> : null}
                          {state === 'excluded' ? <Badge tone="rose">excluded</Badge> : null}
                          {state === 'included' ? <Badge tone="green">included</Badge> : null}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {ACTIONS.map((act) => (
                            <ActionForm
                              key={act.state}
                              action={setTopicOverride}
                              submitLabel={act.label}
                              className="inline"
                            >
                              <input type="hidden" name="school_class_id" value={current.schoolClassId} />
                              <input type="hidden" name="subject_id" value={current.subjectId} />
                              <input type="hidden" name="topic_id" value={t.id} />
                              <input type="hidden" name="state" value={act.state} />
                            </ActionForm>
                          ))}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}

      <p className="mt-4 text-sm text-slate-500">
        Need practice material for emphasized topics?{' '}
        <Link href="/teacher/notes" className="font-semibold text-indigo-600 hover:underline">
          Add notes and practice questions →
        </Link>
      </p>
    </>
  )
}
