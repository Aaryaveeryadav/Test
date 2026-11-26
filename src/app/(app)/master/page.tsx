import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardTitle, PageHeader, StatCard } from '@/components/ui'

export const metadata = { title: 'Platform overview' }

export default async function MasterHome() {
  await requireRole('master_admin')
  const admin = createAdminClient()

  const [{ data: schools }, { data: users }, { data: subjects }, { data: docs }, { data: chunks }] = await Promise.all([
    admin.from('schools').select('id, status'),
    admin.from('profiles').select('id, role, status'),
    admin.from('subjects').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('documents').select('id, status'),
    admin.from('chunks').select('id', { count: 'exact', head: true }).eq('status', 'approved')
  ])

  const activeSchools = (schools ?? []).filter((s) => s.status === 'active').length
  const suspended = (schools ?? []).length - activeSchools
  const byRole = (r: string) => (users ?? []).filter((u) => u.role === r && u.status === 'active').length
  const indexedDocs = (docs ?? []).filter((d) => d.status === 'indexed').length

  return (
    <>
      <PageHeader title="Platform overview" subtitle="All schools, curriculum and the retrieval index." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Schools" value={`${activeSchools} active`} hint={suspended > 0 ? `${suspended} suspended` : 'none suspended'} />
        <StatCard label="Students" value={byRole('student')} />
        <StatCard label="Teachers" value={byRole('teacher')} />
        <StatCard label="School admins" value={byRole('school_admin')} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active subjects" value={subjects?.length ?? 0} hint="master curriculum" />
        <StatCard label="Documents" value={docs?.length ?? 0} hint={`${indexedDocs} indexed`} />
        <StatCard label="Search chunks" value={chunks?.length ?? 0} hint="textbook/PYQ/notes passages" />
        <StatCard label="AI backend" value="Local only" hint="Ollama on your hardware — no cloud fallback" />
      </div>

      <Card className="mt-6">
        <CardTitle>Reminders</CardTitle>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Curriculum changes and school suspensions are recorded in the audit log.</li>
          <li>Master-admin accounts are provisioned with the <code>npm run master:admin</code> script — never via public signup.</li>
          <li>Documents must be extracted, reviewed page-by-page, and approved before students&apos; tutor can cite them.</li>
          <li>Keep <code>SUPABASE_SERVICE_ROLE_KEY</code> server-side only; rotate keys if they ever appear in logs.</li>
        </ul>
      </Card>
    </>
  )
}
