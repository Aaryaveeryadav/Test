import { requireProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppNav } from '@/components/nav'
import { signOutAction } from '@/actions/auth-actions'
import { ROLE_LABEL } from '@/lib/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile()

  let schoolName: string | null = null
  if (profile.school_id) {
    const admin = createAdminClient()
    const { data: school } = await admin
      .from('schools')
      .select('name, status')
      .eq('id', profile.school_id)
      .maybeSingle()
    schoolName = school ? `${school.name}${school.status === 'suspended' ? ' (suspended)' : ''}` : null
  }

  return (
    <div className="min-h-dvh">
      <AppNav
        role={profile.role}
        fullName={profile.full_name}
        roleLabel={ROLE_LABEL[profile.role]}
        schoolName={schoolName}
        signOut={signOutAction}
      />
      <main id="main" className="lg:pl-60">
        <div className="mx-auto max-w-6xl p-4 sm:p-6">{children}</div>
      </main>
    </div>
  )
}
