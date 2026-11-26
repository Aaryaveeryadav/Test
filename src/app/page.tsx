import { Suspense } from 'react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { ROLE_HOME } from '@/lib/types'
import { BrandLockup } from '@/components/brand'
import { LangToggle } from '@/components/lang-toggle'
import { LoginForm } from './login/login-form'
import { LANG_COOKIE, resolveLang, type Lang } from '@/lib/i18n'

/**
 * The site opens straight into sign-in (per request) — no marketing landing.
 * Signed-in users go to their role's home.
 */
export default async function AuthEntryPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const profile = await getProfile()
  if (profile) redirect(ROLE_HOME[profile.role])

  const params = await searchParams
  const lang: Lang = resolveLang((await cookies()).get(LANG_COOKIE)?.value)
  const hi = lang === 'hi'
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <BrandLockup />
        <nav className="flex items-center gap-3 text-sm font-semibold">
          <LangToggle lang={lang} />
          <Link href="/privacy" className="text-stone-500 hover:text-stone-800">
            {hi ? 'गोपनीयता' : 'Privacy'}
          </Link>
        </nav>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          {!configured ? (
            <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>{hi ? 'सेटअप बाकी:' : 'Setup needed:'}</strong>{' '}
              {hi
                ? 'Supabase पर्यावरण चर सेट नहीं हैं। .env.example को .env.local में कॉपी करें।'
                : 'Supabase environment variables are not configured yet. Copy .env.example to .env.local.'}
            </div>
          ) : null}

          <div className="mb-6 text-center">
            <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-stone-900">
              {hi ? 'सहायक में साइन इन करें' : 'Sign in to Sahayak'}
            </h1>
            <p className="mt-1.5 text-sm text-stone-500">
              {hi
                ? 'सबके लिए एक ही लॉगिन — छात्र, शिक्षक और प्रशासक। आपकी भूमिका आपके खाते से तय होती है।'
                : 'One login for everyone — students, teachers and administrators. Your role comes from your account.'}
            </p>
          </div>

          {params.error === 'no_profile' ? (
            <div role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              {hi
                ? 'आपका खाता अभी स्वीकृत नहीं हुआ है। कृपया अपने विद्यालय प्रशासक की स्वीकृति की प्रतीक्षा करें।'
                : 'Your account is not approved yet. If you requested access, please wait for your school administrator to approve it.'}
            </div>
          ) : null}

          <div className="card">
            <Suspense>
              <LoginForm nextPath={params.next ?? '/'} />
            </Suspense>
          </div>

          <p className="mt-4 text-center text-sm text-stone-500">
            {hi ? 'यहाँ नए हैं? ' : 'New here? '}
            <Link href="/signup" className="font-semibold text-rose-600 hover:underline">
              {hi
                ? 'विद्यालय कोड से पहुँच का अनुरोध करें'
                : 'Request access with your school code'}
            </Link>
          </p>
          <p className="mt-6 text-center text-xs text-stone-400">
            {hi
              ? 'मास्टर-प्रशासक खाते केवल सुरक्षित प्रावधान से बनते हैं — इस पृष्ठ से नहीं।'
              : 'Master-administrator accounts are provisioned securely and cannot be created from this page.'}
          </p>
        </div>
      </main>

      <footer className="border-t border-stone-200/70 py-4 text-center text-xs text-stone-400">
        Sahayak Study Platform ·{' '}
        {hi
          ? 'AI उत्तर सदा सत्यापित नहीं होते — अपने शिक्षकों से जाँच करते रहें।'
          : 'AI answers are not guaranteed correct — always verify with your teachers.'}
      </footer>
    </div>
  )
}
