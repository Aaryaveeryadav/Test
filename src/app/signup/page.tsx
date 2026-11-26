import { Suspense } from 'react'
import { GraduationCap } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { RequestAccessForm, InviteSignupForm } from './signup-form'

export const metadata = { title: 'Request access' }

export default async function SignupPage({
  searchParams
}: {
  searchParams: Promise<{ invite?: string }>
}) {
  const params = await searchParams
  let invite: { email: string; role: 'teacher' | 'school_admin'; schoolName: string } | null = null
  let inviteError: string | null = null

  if (params.invite) {
    try {
      const admin = createAdminClient()
      const { data: inv } = await admin
        .from('invitations')
        .select('email, role, status, expires_at, schools(name)')
        .eq('token', params.invite)
        .maybeSingle()
      const schoolName = (inv?.schools as unknown as { name: string } | null)?.name ?? null
      if (!inv || inv.status !== 'pending') {
        inviteError = 'This invitation is no longer valid.'
      } else if (new Date(inv.expires_at).getTime() < Date.now()) {
        inviteError = 'This invitation has expired. Please ask your administrator for a new one.'
      } else {
        invite = {
          email: inv.email,
          role: inv.role as 'teacher' | 'school_admin',
          schoolName: schoolName ?? 'your school'
        }
      }
    } catch {
      inviteError = 'Could not verify the invitation (Supabase may not be configured on this server).'
    }
  }

  return (
    <main id="main" className="mx-auto min-h-dvh w-full max-w-xl px-4 py-10">
      <div className="mb-6 text-center">
        <GraduationCap className="mx-auto h-10 w-10 text-rose-600" />
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
          {invite ? 'Complete your staff account' : 'Request access'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {invite
            ? 'You were invited by your school. Set your password to finish setup.'
            : 'Students join with a school code and roll number. Teachers are approved or invited by the school — nobody becomes a teacher by simply selecting it here.'}
        </p>
      </div>

      {inviteError ? (
        <div role="alert" className="mb-4 rounded-lg bg-rose-50 p-4 text-sm text-rose-700">
          {inviteError}
          <p className="mt-2">
            If you are a student, you can still{' '}
            <a href="/signup" className="font-semibold underline">
              request access with your school code
            </a>
            .
          </p>
        </div>
      ) : null}

      {invite ? (
        <div className="card">
          <InviteSignupForm token={params.invite!} email={invite.email} role={invite.role} schoolName={invite.schoolName} />
        </div>
      ) : (
        <div className="card">
          <Suspense>
            <RequestAccessForm />
          </Suspense>
        </div>
      )}

      <p className="mt-4 text-center text-sm text-slate-500">
        Already approved?{' '}
        <a href="/login" className="font-semibold text-rose-600 hover:underline">
          Sign in
        </a>
      </p>
    </main>
  )
}
