import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardTitle, PageHeader, StatCard } from '@/components/ui'

export const metadata = { title: 'School overview' }

export default async function AdminHome() {
  const profile = await requireRole('school_admin')
  const admin = createAdminClient()

  const [{ data: users }, { data: classes }, { data: pending }, { data: school }] = await Promise.all([
    admin.from('profiles').select('id, role, status').eq('school_id', profile.school_id),
    admin.from('school_classes').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id),
    admin.from('signup_requests').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id).eq('status', 'pending'),
    admin.from('schools').select('name, status, settings').eq('id', profile.school_id).maybeSingle()
  ])

  const students = (users ?? []).filter((u) => u.role === 'student').length
  const teachers = (users ?? []).filter((u) => u.role === 'teacher').length
  const inactive = (users ?? []).filter((u) => u.status !== 'active').length
  const settings = (school?.settings ?? {}) as { ranking_enabled?: boolean; retention_days?: number }

  return (
    <>
      <PageHeader title={school?.name ?? 'School overview'} subtitle="Your school's people and structure at a glance.">
        {school?.status === 'suspended' ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            This school is currently suspended by the platform administrator — staff and students cannot sign in.
          </p>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={students} hint={`${inactive} inactive accounts`} />
        <StatCard label="Teachers" value={teachers} />
        <StatCard label="Class sections" value={classes?.length ?? 0} />
        <StatCard label="Pending requests" value={pending?.length ?? 0} hint="waiting for your approval" />
      </div>

      <Card className="mt-6">
        <CardTitle>School settings (managed by the platform administrator)</CardTitle>
        <ul className="space-y-1 text-sm text-slate-600">
          <li>
            Class ranking: <strong>{settings.ranking_enabled ? 'Enabled' : 'Disabled'}</strong> — when enabled it stays
            inside each class and is visible only to that class&apos;s teachers.
          </li>
          <li>
            Chat retention: <strong>{settings.retention_days ?? 90} days</strong> — tutor chats are deleted
            automatically after this window.
          </li>
        </ul>
        <p className="mt-2 text-xs text-slate-400">
          Need a change? Contact the platform (master) administrator — changes are recorded in the audit log.
        </p>
      </Card>
    </>
  )
}
