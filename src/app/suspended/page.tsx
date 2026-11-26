import { ShieldAlert } from 'lucide-react'
import { signOutAction } from '@/actions/auth-actions'

export const metadata = { title: 'Access suspended' }

export default function SuspendedPage() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4">
      <div className="card max-w-md text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-rose-500" />
        <h1 className="mt-3 text-xl font-bold">Access unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your account is inactive, or your school has been suspended by the platform administrator. While this is the
          case, you cannot sign in or use the study tools. Existing sessions have been ended.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Please contact your school office or the platform administrator if you believe this is a mistake.
        </p>
        <form action={signOutAction} className="mt-5">
          <button type="submit" className="btn-secondary w-full">
            Sign out
          </button>
        </form>
      </div>
    </main>
  )
}
