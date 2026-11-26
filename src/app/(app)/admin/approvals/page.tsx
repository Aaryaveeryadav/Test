import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { ActionForm, ApprovalForm, InviteLinkForm } from '@/components/action-form'
import { Badge, Card, CardTitle, EmptyState, PageHeader } from '@/components/ui'
import { approveRequest, createInvitation, rejectRequest, revokeInvitation } from '@/actions/admin-actions'
import { formatDate } from '@/lib/utils'

export const metadata = { title: 'Approvals & invites' }

export default async function ApprovalsPage() {
  const profile = await requireRole('school_admin')
  const admin = createAdminClient()

  const [{ data: requests }, { data: invitations }] = await Promise.all([
    admin
      .from('signup_requests')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('invitations')
      .select('id, email, full_name, role, status, token, expires_at, created_at')
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false })
      .limit(50)
  ])

  const pending = (requests ?? []).filter((r) => r.status === 'pending')
  const reviewed = (requests ?? []).filter((r) => r.status !== 'pending')
  const activeInvites = (invitations ?? []).filter((i) => i.status === 'pending')

  return (
    <>
      <PageHeader
        title="Approvals & invitations"
        subtitle="Students request access with your school code; you approve here. Teachers join only by approval or invitation — never self-signup."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle right={<Badge tone="amber">{pending.length} pending</Badge>}>Access requests</CardTitle>
          {pending.length === 0 ? (
            <EmptyState title="No pending requests" />
          ) : (
            <ul className="space-y-3">
              {pending.map((r) => (
                <li key={r.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-800">{r.full_name}</span>
                    <Badge tone={r.requested_role === 'teacher' ? 'sky' : 'indigo'}>
                      {r.requested_role === 'teacher' ? 'Teacher' : 'Student'}
                    </Badge>
                    <span className="text-xs text-slate-400">{formatDate(r.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {r.email}
                    {r.roll_number ? ` · Roll ${r.roll_number}` : ''}
                  </p>
                  {r.requested_role === 'student' ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Guardian: {r.guardian_name ?? '—'} {r.guardian_contact ? `· ${r.guardian_contact}` : ''} · Consent:{' '}
                      {r.guardian_consent ? '✓ given' : '✗ missing'}
                    </p>
                  ) : null}
                  {r.note ? <p className="mt-1 text-xs text-slate-500">Note: {r.note}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-3">
                    <ApprovalForm action={approveRequest} requestId={r.id} label="Approve & create account" />
                    <ActionForm action={rejectRequest} submitLabel="Reject" className="inline">
                      <input type="hidden" name="request_id" value={r.id} />
                    </ActionForm>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>Invite a teacher</CardTitle>
            <p className="mb-3 text-sm text-slate-500">
              Share the secret link with the teacher. They set their own password. Links expire in 7 days.
            </p>
            <InviteLinkForm action={createInvitation} submitLabel="Create invitation" role="teacher" />
            {activeInvites.length > 0 ? (
              <div className="mt-4 border-t pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Pending invitations</p>
                <ul className="space-y-2">
                  {activeInvites.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-slate-600">
                        {i.email} <span className="text-xs text-slate-400">· expires {formatDate(i.expires_at)}</span>
                      </span>
                      <ActionForm action={revokeInvitation} submitLabel="Revoke" className="inline">
                        <input type="hidden" name="invitation_id" value={i.id} />
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Recently reviewed</CardTitle>
            {reviewed.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {reviewed.slice(0, 10).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-slate-600">
                      {r.full_name} · {r.email}
                    </span>
                    <Badge tone={r.status === 'approved' ? 'green' : 'rose'}>{r.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
