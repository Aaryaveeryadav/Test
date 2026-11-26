import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { ActionForm, InviteLinkForm } from '@/components/action-form'
import { Badge, Card, CardTitle, PageHeader } from '@/components/ui'
import { inviteSchoolAdmin, setSchoolStatus, updateSchoolSettings, upsertSchool } from '@/actions/master-actions'
import { formatDate } from '@/lib/utils'

export const metadata = { title: 'Schools' }

export default async function SchoolsPage() {
  await requireRole('master_admin')
  const admin = createAdminClient()

  const [{ data: schools }, { data: boards }, { data: counts }] = await Promise.all([
    admin.from('schools').select('id, name, code, status, settings, created_at, boards(name)').order('created_at', { ascending: false }),
    admin.from('boards').select('id, name').eq('status', 'active').order('name'),
    admin.from('profiles').select('school_id, id')
  ])

  const memberCount = new Map<string, number>()
  for (const p of counts ?? []) {
    if (p.school_id) memberCount.set(p.school_id, (memberCount.get(p.school_id) ?? 0) + 1)
  }

  return (
    <>
      <PageHeader
        title="Schools"
        subtitle="Create schools, hand each one a signup code, and suspend/reactivate access. Suspension revokes all users' sessions immediately and is recorded in the audit log."
      />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardTitle>Add a school</CardTitle>
          <ActionForm action={upsertSchool} submitLabel="Create school">
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="name">
                  School name
                </label>
                <input id="name" name="name" required maxLength={120} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="code">
                  Signup code
                </label>
                <input id="code" name="code" required maxLength={20} className="input uppercase" placeholder="e.g. DPS-BPL-2026" />
              </div>
              <div>
                <label className="label" htmlFor="board_id">
                  Board
                </label>
                <select id="board_id" name="board_id" className="input">
                  <option value="">—</option>
                  {(boards ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="address">
                  Address (optional)
                </label>
                <input id="address" name="address" maxLength={200} className="input" />
              </div>
            </div>
          </ActionForm>
        </Card>

        <div className="space-y-4">
          {(schools ?? []).map((s) => {
            const settings = (s.settings ?? {}) as { ranking_enabled?: boolean; retention_days?: number }
            const board = s.boards as unknown as { name: string } | null
            return (
              <Card key={s.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-500">
                      Code <code className="rounded bg-slate-100 px-1">{s.code}</code> · {board?.name ?? 'no board'} ·{' '}
                      {memberCount.get(s.id) ?? 0} members · joined {formatDate(s.created_at)}
                    </p>
                  </div>
                  <Badge tone={s.status === 'active' ? 'green' : 'rose'}>{s.status}</Badge>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Access</p>
                    <ActionForm
                      action={setSchoolStatus}
                      submitLabel={s.status === 'active' ? 'Suspend school' : 'Reactivate school'}
                      className="inline"
                    >
                      <input type="hidden" name="school_id" value={s.id} />
                      <input type="hidden" name="status" value={s.status === 'active' ? 'suspended' : 'active'} />
                    </ActionForm>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Settings</p>
                    <ActionForm action={updateSchoolSettings} submitLabel="Save settings">
                      <input type="hidden" name="school_id" value={s.id} />
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="ranking_enabled" defaultChecked={Boolean(settings.ranking_enabled)} />
                        Class ranking enabled
                      </label>
                      <div className="mt-2">
                        <label className="text-xs text-slate-500" htmlFor={`ret_${s.id}`}>
                          Chat retention (days)
                        </label>
                        <input
                          id={`ret_${s.id}`}
                          name="retention_days"
                          type="number"
                          min={7}
                          max={3650}
                          defaultValue={settings.retention_days ?? 90}
                          className="input max-w-[120px]"
                        />
                      </div>
                    </ActionForm>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Invite school admin</p>
                    <InviteLinkForm action={inviteSchoolAdmin} submitLabel="Create invite" schoolId={s.id} role="school_admin" />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </>
  )
}
