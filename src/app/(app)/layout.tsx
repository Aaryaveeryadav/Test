import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { requireProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppNav } from '@/components/nav'
import { TopBar } from '@/components/top-bar'
import { getStudentContext } from '@/lib/data'
import { signOutAction } from '@/actions/auth-actions'
import { ROLE_LABEL } from '@/lib/types'
import { LANG_COOKIE, resolveLang } from '@/lib/i18n'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile()
  const lang = resolveLang((await cookies()).get(LANG_COOKIE)?.value)

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

  let studentCtx: Awaited<ReturnType<typeof getStudentContext>> = null
  if (profile.role === 'student') studentCtx = await getStudentContext(profile)

  return (
    <div className="min-h-dvh">
      <AppNav
        role={profile.role}
        fullName={profile.full_name}
        roleLabel={ROLE_LABEL[profile.role]}
        schoolName={schoolName}
        signOut={signOutAction}
        subjectCount={studentCtx?.subjects.length ?? null}
        lang={lang}
      />
      <main id="main" className="lg:pl-60">
        <Suspense>
          <TopBar
            role={profile.role}
            fullName={profile.full_name}
            boardCode={studentCtx?.boardCode ?? null}
            grade={studentCtx?.grade ?? null}
            subjects={studentCtx ? studentCtx.subjects.map((s) => ({ id: s.id, name: s.name })) : null}
            lang={lang}
          />
        </Suspense>
        <div className="mx-auto max-w-6xl p-4 sm:p-6">{children}</div>
      </main>
    </div>
  )
}
