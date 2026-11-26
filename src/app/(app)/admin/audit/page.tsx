import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardTitle, EmptyState, PageHeader } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'

export const metadata = { title: 'Audit log' }

export default async function AdminAuditPage() {
  const profile = await requireRole('school_admin')
  const admin = createAdminClient()
  const { data: logs } = await admin
    .from('audit_logs')
    .select('id, action, entity, entity_id, details, created_at, profiles(full_name)')
    .eq('school_id', profile.school_id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Sensitive changes for your school (approvals, deactivations, teacher assignments). Newest first, last 100 entries."
      />
      <Card>
        <CardTitle>Recent events</CardTitle>
        {logs?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr>
                  <th className="th">When</th>
                  <th className="th">Actor</th>
                  <th className="th">Action</th>
                  <th className="th">Entity</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="td whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                    <td className="td">{(l.profiles as unknown as { full_name: string } | null)?.full_name ?? '—'}</td>
                    <td className="td font-mono text-xs">{l.action}</td>
                    <td className="td text-xs text-slate-500">
                      {l.entity ?? ''} {l.entity_id ? `· ${String(l.entity_id).slice(0, 8)}…` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No audit events yet" />
        )}
      </Card>
    </>
  )
}
