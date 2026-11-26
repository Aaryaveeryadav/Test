import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { ActionForm } from '@/components/action-form'
import { BackLink, Badge, Card, CardTitle, PageHeader } from '@/components/ui'
import { approveDocument, extractDocument, rejectDocument, savePageContent } from '@/actions/master-actions'

export const metadata = { title: 'Review document' }

export default async function DocumentReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('master_admin')
  const { id } = await params
  const admin = createAdminClient()

  const { data: doc } = await admin
    .from('documents')
    .select('id, title, kind, status, page_count, subject_id, chapter_id, created_at')
    .eq('id', id)
    .maybeSingle()
  if (!doc) notFound()
  const { data: pages } = await admin
    .from('document_pages')
    .select('id, page_number, content, status')
    .eq('document_id', id)
    .order('page_number')

  const needsOcr = (pages ?? []).filter((p) => p.status === 'needs_ocr').length
  const pending = (pages ?? []).filter((p) => p.status === 'pending').length

  return (
    <>
      <BackLink href="/master/documents">All documents</BackLink>
      <PageHeader
        title={doc.title}
        subtitle={`Review extracted pages before approving. Page numbers are preserved so tutor answers can cite them.`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={doc.status === 'indexed' ? 'green' : doc.status === 'rejected' ? 'rose' : 'amber'}>{doc.status}</Badge>
          <Badge tone="slate">{doc.kind}</Badge>
          {doc.page_count ? <Badge tone="slate">{doc.page_count} pages</Badge> : null}
          {needsOcr > 0 ? <Badge tone="rose">{needsOcr} pages need OCR</Badge> : null}
          {pending > 0 ? <Badge tone="amber">{pending} pages pending review</Badge> : null}
        </div>
      </PageHeader>

      <Card className="mb-4">
        <CardTitle>Pipeline</CardTitle>
        <p className="mb-3 text-sm text-slate-600">
          1. <strong>Extract text</strong> (server-side, per page). 2. <strong>Review &amp; fix</strong> pages below.
          3. <strong>Approve &amp; index</strong> — chunks are embedded with the local model and become citable
          material. Pages marked &quot;needs OCR&quot; are images/scans: the MVP cannot read them automatically — type
          or paste their content manually, or skip them.
        </p>
        <div className="flex flex-wrap gap-3">
          <ActionForm action={extractDocument} submitLabel="1 · Extract text" className="inline">
            <input type="hidden" name="document_id" value={id} />
          </ActionForm>
          <ActionForm action={approveDocument} submitLabel="3 · Approve & index" className="inline">
            <input type="hidden" name="document_id" value={id} />
          </ActionForm>
          <ActionForm action={rejectDocument} submitLabel="Reject document" className="inline">
            <input type="hidden" name="document_id" value={id} />
          </ActionForm>
        </div>
      </Card>

      {(pages ?? []).length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">
            No pages extracted yet. Click <strong>Extract text</strong> above.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {pages!.map((p) => (
            <Card key={p.id}>
              <CardTitle
                right={
                  <Badge
                    tone={
                      p.status === 'approved' || p.status === 'edited'
                        ? 'green'
                        : p.status === 'needs_ocr'
                          ? 'rose'
                          : 'amber'
                    }
                  >
                    page {p.page_number} · {p.status}
                  </Badge>
                }
              >
                Page {p.page_number}
              </CardTitle>
              <ActionForm action={savePageContent} submitLabel="Save page">
                <input type="hidden" name="page_id" value={p.id} />
                <textarea
                  name="content"
                  rows={6}
                  defaultValue={p.content}
                  className="input font-mono text-xs"
                  aria-label={`Content of page ${p.page_number}`}
                />
              </ActionForm>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
