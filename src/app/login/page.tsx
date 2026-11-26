import { Suspense } from 'react'
import { GraduationCap } from 'lucide-react'
import { LoginForm } from './login-form'

export const metadata = { title: 'Sign in' }

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const params = await searchParams
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-rose-600" />
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Sign in to Sahayak</h1>
          <p className="mt-1 text-sm text-slate-500">
            One login for everyone — students, teachers and administrators. Your role comes from your account.
          </p>
        </div>

        {params.error === 'no_profile' ? (
          <div role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Your account is not approved yet. If you requested access, please wait for your school administrator to
            approve it.
          </div>
        ) : null}

        <div className="card">
          <Suspense>
            <LoginForm nextPath={params.next ?? '/'}/>
          </Suspense>
        </div>

        <p className="mt-4 text-center text-sm text-slate-500">
          New here?{' '}
          <a href="/signup" className="font-semibold text-rose-600 hover:underline">
            Request access with your school code
          </a>
        </p>
        <p className="mt-6 text-center text-xs text-slate-400">
          Master-administrator accounts are provisioned securely and cannot be created from this page.
        </p>
      </div>
    </main>
  )
}
