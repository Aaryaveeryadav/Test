import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { ActionForm } from '@/components/action-form'
import { Badge, Card, CardTitle, PageHeader } from '@/components/ui'
import { setUserStatus } from '@/actions/admin-actions'
import { formatDate } from '@/lib/utils'

export const metadata = { title: 'Users' }

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<{ role?: string }>
}) {
  const profile = await requireRole('school_admin')
  const params = await searchParams
  const roleFilter = ['student', 'teacher'].includes(params.role ?? '') ? params.role : null

  const admin = createAdminClient()
  let query = admin
    .from('profiles')
    .select('id, full_name, email, role, status, roll_number, created_at')
    .eq('school_id', profile.school_id)
    .order('created_at', { ascending: false })
    .limit(300)
  if (roleFilter) query = query.eq('role', roleFilter)
  const { data: users } = await query

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Deactivating a user revokes their access immediately, including live sessions. This is recorded in the audit log."
      >
        <div className="flex gap-2">
          {[
            { id: '', label: 'All' },
            { id: 'student', label: 'Students' },
            { id: 'teacher', label: 'Teachers' }
          ].map((f) => (
            <a
              key={f.id}
              href={f.id ? `/admin/users?role=${f.id}` : '/admin/users'}
              className={roleFilter === f.id ? 'btn-primary' : 'btn-secondary'}
            >
              {f.label}
            </a>
          ))}
        </div>
      </PageHeader>

      <Card>
        <CardTitle>Accounts ({users?.length ?? 0})</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <th className="th">Name</th>
                <th className="th">Email</th>
                <th className="th">Role</th>
                <th className="th">Roll</th>
                <th className="th">Status</th>
                <th className="th">Joined</th>
                <th className="th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(users ?? []).map((u) => (
                <tr key={u.id}>
                  <td className="td font-medium">{u.full_name}</td>
                  <td className="td">{u.email}</td>
                  <td className="td">
                    <Badge tone={u.role === 'teacher' ? 'sky' : 'indigo'}>{u.role === 'school_admin' ? 'admin' : u.role}</Badge>
                  </td>
                  <td className="td">{u.roll_number ?? '—'}</td>
                  <td className="td">
                    <Badge tone={u.status === 'active' ? 'green' : 'rose'}>{u.status}</Badge>
                  </td>
                  <td className="td">{formatDate(u.created_at)}</td>
                  <td className="td">
                    {u.id === profile.id ? (
                      <span className="text-xs text-slate-400">you</span>
                    ) : (
                      <ActionForm
                        action={setUserStatus}
                        submitLabel={u.status === 'active' ? 'Deactivate' : 'Reactivate'}
                        className="inline"
                      >
                        <input type="hidden" name="user_id" value={u.id} />
                        <input type="hidden" name="status" value={u.status === 'active' ? 'inactive' : 'active'} />
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
