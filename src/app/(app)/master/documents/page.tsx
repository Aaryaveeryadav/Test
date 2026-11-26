import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { ActionForm } from '@/components/action-form'
import { Badge, Card, CardTitle, EmptyState, PageHeader } from '@/components/ui'
import { uploadDocument } from '@/actions/master-actions'
import { formatDate } from '@/lib/utils'

export const metadata = { title: 'Books & documents' }

export default async function DocumentsPage() {
  await requireRole('master_admin')
  const admin = createAdminClient()

  const [{ data: docs }, { data: subjects }, { data: chapters }] = await Promise.all([
    admin.from('documents').select('id, title, kind, status, page_count, created_at, subject_id, chapter_id, owner_scope').order('created_at', { ascending: false }).limit(100),
    admin.from('subjects').select('id, name, classes(grade), status').eq('status', 'active').order('name'),
    admin.from('chapters').select('id, number, title, subject_id, status').order('number')
  ])

  const subjectLabel = new Map(
    (subjects ?? []).map((s) => [s.id, `${(s.classes as unknown as { grade: number } | null)?.grade ?? ''} · ${s.name}`])
  )
  const chapterLabel = new Map(
    (chapters ?? []).map((c) => [c.id, `Ch ${c.number}. ${c.title}`])
  )

  return (
    <>
      <PageHeader
        title="Books & documents"
        subtitle="Upload approved textbooks, syllabus documents and question banks. Extraction runs on the server; you review every page before it becomes searchable — students' tutor can then cite these pages."
      />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardTitle>Upload PDF</CardTitle>
          <ActionForm action={uploadDocument} submitLabel="Upload">
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="title">
                  Title
                </label>
                <input id="title" name="title" required maxLength={150} className="input" placeholder="e.g. Science — NCERT Class 10 (demo)" />
              </div>
              <div>
                <label className="label" htmlFor="subject_id">
                  Subject
                </label>
                <select id="subject_id" name="subject_id" required className="input">
                  <option value="">—</option>
                  {(subjects ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {subjectLabel.get(s.id) ?? s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="chapter_id">
                  Chapter (optional — binds citations to one chapter)
                </label>
                <select id="chapter_id" name="chapter_id" className="input">
                  <option value="">—</option>
                  {(chapters ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {(subjectLabel.get((c as { subject_id: string }).subject_id) ?? '')} · Ch {c.number}. {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="kind">
                  Kind
                </label>
                <select id="kind" name="kind" className="input">
                  <option value="textbook">Textbook</option>
                  <option value="syllabus">Syllabus</option>
                  <option value="pyq">Question bank / PYQs</option>
                  <option value="teacher_notes">Teacher notes</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="file">
                  PDF file (max 25 MB)
                </label>
                <input id="file" name="file" type="file" accept="application/pdf" required className="input" />
              </div>
            </div>
          </ActionForm>
        </Card>

        <Card>
          <CardTitle>Documents</CardTitle>
          {(docs ?? []).length === 0 ? (
            <EmptyState title="No documents yet" hint="Upload the first approved material above." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th className="th">Title</th>
                    <th className="th">Subject</th>
                    <th className="th">Kind</th>
                    <th className="th">Pages</th>
                    <th className="th">Status</th>
                    <th className="th">Uploaded</th>
                    <th className="th">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(docs ?? []).map((d) => (
                    <tr key={d.id}>
                      <td className="td font-medium">
                        {d.title}
                        {d.chapter_id ? (
                          <span className="block text-xs text-slate-400">{chapterLabel.get(d.chapter_id) ?? ''}</span>
                        ) : null}
                      </td>
                      <td className="td">{subjectLabel.get(d.subject_id) ?? '—'}</td>
                      <td className="td text-xs">{d.kind}</td>
                      <td className="td">{d.page_count ?? '—'}</td>
                      <td className="td">
                        <Badge tone={d.status === 'indexed' ? 'green' : d.status === 'rejected' ? 'rose' : 'amber'}>
                          {d.status}
                        </Badge>
                      </td>
                      <td className="td whitespace-nowrap text-xs">{formatDate(d.created_at)}</td>
                      <td className="td">
                        <Link href={`/master/documents/${d.id}`} className="text-xs font-semibold text-indigo-600 hover:underline">
                          Open →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
