import { requireRole } from '@/lib/auth'
import { getSubjectChapters, getTeacherAssignments } from '@/lib/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { ActionForm } from '@/components/action-form'
import { Badge, Card, CardTitle, EmptyState, PageHeader } from '@/components/ui'
import { archiveNote, upsertNote } from '@/actions/teacher-actions'
import { formatDate } from '@/lib/utils'

export const metadata = { title: 'Notes & practice' }

export default async function NotesPage() {
  const profile = await requireRole('teacher')
  const assignments = await getTeacherAssignments(profile)

  if (assignments.length === 0) {
    return (
      <>
        <PageHeader title="Notes & practice questions" />
        <EmptyState title="No class assignments yet" hint="You need a class-subject assignment before adding notes." />
      </>
    )
  }

  const admin = createAdminClient()
  const { data: notes } = await admin
    .from('school_notes')
    .select('id, title, body, kind, status, created_at, subjects(name), school_classes(section, classes(grade, label))')
    .eq('author_id', profile.id)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(50)

  const chaptersByAssignment = await Promise.all(
    assignments.map(async (a) => [a.id, await getSubjectChapters(a.subjectId)] as const)
  )
  const topicOptions: { id: string; label: string }[] = []
  for (const [aid, chapters] of chaptersByAssignment) {
    const a = assignments.find((x) => x.id === aid)!
    for (const c of chapters) {
      for (const t of c.topics) {
        topicOptions.push({ id: t.id, label: `Class ${a.grade} ${a.section} · ${a.subjectName} — Ch ${c.number} ${c.title} · ${t.title}` })
      }
    }
  }

  return (
    <>
      <PageHeader
        title="Notes & practice questions"
        subtitle="Class-specific emphasis and material. These live in your school — the master curriculum stays untouched. Published items also feed the tutor's school-scoped retrieval."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Add a note or practice question</CardTitle>
          <ActionForm action={upsertNote} submitLabel="Save">
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="assignment">
                  Class &amp; subject
                </label>
                <select id="assignment" name="assignment_id" className="input" required>
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      Class {a.grade} {a.className} {a.section} · {a.subjectName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="kind">
                  Type
                </label>
                <select id="kind" name="kind" className="input">
                  <option value="note">Note / emphasis</option>
                  <option value="practice_question">Practice question</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="topic">
                  Topic (optional)
                </label>
                <select id="topic" name="topic_id" className="input">
                  <option value="">—</option>
                  {topicOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
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
                <label className="label" htmlFor="body">
                  Content
                </label>
                <textarea id="body" name="body" required rows={6} maxLength={5000} className="input" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="publish" value="1" defaultChecked />
                Publish immediately (students see it; the tutor can cite it)
              </label>
            </div>
          </ActionForm>
        </Card>

        <Card>
          <CardTitle>My notes &amp; practice questions</CardTitle>
          {notes?.length ? (
            <ul className="space-y-3">
              {notes.map((n) => {
                const cls = n.school_classes as unknown as { section: string; classes: { grade: number; label: string | null } | null } | null
                return (
                  <li key={n.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-800">{n.title}</span>
                      {n.kind === 'practice_question' ? <Badge tone="indigo">practice</Badge> : <Badge tone="slate">note</Badge>}
                      {n.status === 'published' ? <Badge tone="green">published</Badge> : <Badge tone="amber">draft</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {(n.subjects as unknown as { name: string } | null)?.name} · Class {cls?.classes?.grade ?? ''}
                      {cls?.section ? ` ${cls.section}` : ''} · {formatDate(n.created_at)}
                    </p>
                    <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-slate-600">{n.body}</p>
                    {n.status !== 'archived' ? (
                      <div className="mt-2">
                        <ActionForm action={archiveNote} submitLabel="Archive" className="inline">
                          <input type="hidden" name="note_id" value={n.id} />
                        </ActionForm>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Nothing yet. Notes you publish appear in students&apos; subject pages and the tutor&apos;s references.</p>
          )}
        </Card>
      </div>
    </>
  )
}
