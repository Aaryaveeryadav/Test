'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { requestAccess, completeInvite } from '@/actions/auth-actions'
import { SubmitButton } from '@/components/action-form'

export function RequestAccessForm() {
  const [state, formAction] = useActionState(requestAccess, {})
  const [role, setRole] = useState<'student' | 'teacher'>('student')

  if (state.success) {
    return (
      <div role="status" className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
        <p className="font-semibold">Request submitted ✓</p>
        <p className="mt-1">{state.success}</p>
        <p className="mt-2">
          <Link href="/login" className="font-semibold underline">
            Go to sign in
          </Link>{' '}
          (after your administrator approves)
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="school_code">
          School code <span className="text-rose-600">*</span>
        </label>
        <input id="school_code" name="school_code" required className="input uppercase" placeholder="e.g. DEMO100" />
        <p className="mt-1 text-xs text-slate-400">Ask your school office for this code.</p>
      </div>

      <div>
        <label className="label" htmlFor="requested_role">
          I am a…
        </label>
        <select
          id="requested_role"
          name="requested_role"
          className="input"
          value={role}
          onChange={(e) => setRole(e.target.value as 'student' | 'teacher')}
        >
          <option value="student">Student</option>
          <option value="teacher">Teacher (needs school approval)</option>
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="full_name">
            Full name <span className="text-rose-600">*</span>
          </label>
          <input id="full_name" name="full_name" required maxLength={80} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email <span className="text-rose-600">*</span>
          </label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
      </div>

      {role === 'student' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="roll_number">
                Roll number <span className="text-rose-600">*</span>
              </label>
              <input id="roll_number" name="roll_number" required maxLength={20} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="guardian_name">
                Guardian name
              </label>
              <input id="guardian_name" name="guardian_name" maxLength={80} className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="guardian_contact">
              Guardian contact (optional)
            </label>
            <input id="guardian_contact" name="guardian_contact" maxLength={40} className="input" />
          </div>
          <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm">
            <input type="checkbox" name="guardian_consent" className="mt-0.5" />
            <span>
              I confirm that my parent/guardian has read the{' '}
              <a href="/privacy" target="_blank" className="font-semibold text-indigo-600 underline">
                privacy notice
              </a>{' '}
              and agrees to this account. <span className="text-rose-600">*</span>
            </span>
          </label>
        </>
      ) : (
        <div>
          <label className="label" htmlFor="note">
            Subjects you teach / qualification (for the school office)
          </label>
          <textarea id="note" name="note" rows={3} maxLength={500} className="input" />
        </div>
      )}

      {state.error ? (
        <p role="alert" className="text-sm font-medium text-rose-600">
          {state.error}
        </p>
      ) : null}

      <SubmitButton>Submit request</SubmitButton>
      <p className="text-xs text-slate-400">
        We collect only what is needed to verify and enroll you: name, email, school code, roll number (students) and
        guardian consent. No Aadhaar or other government ID is ever collected. Phone number is optional and only used
        if your school has an approved need for it.
      </p>
    </form>
  )
}

export function InviteSignupForm({
  token,
  email,
  role,
  schoolName
}: {
  token: string
  email: string
  role: string
  schoolName: string
}) {
  const [state, formAction] = useActionState(completeInvite, {})
  const done = Boolean(state.success)

  if (done) {
    return (
      <div role="status" className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
        <p className="font-semibold">Account created ✓</p>
        <p className="mt-1">{state.success}</p>
        <p className="mt-2">
          <Link href="/login" className="font-semibold underline">
            Sign in now
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <p>
          <span className="text-slate-500">Invited as:</span> <strong>{role === 'school_admin' ? 'School administrator' : 'Teacher'}</strong>
        </p>
        <p>
          <span className="text-slate-500">School:</span> <strong>{schoolName}</strong>
        </p>
        <p>
          <span className="text-slate-500">Email:</span> <strong>{email}</strong>
        </p>
      </div>
      <div>
        <label className="label" htmlFor="full_name">
          Full name
        </label>
        <input id="full_name" name="full_name" required maxLength={80} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password (min 8 characters)
        </label>
        <input id="password" name="password" type="password" required minLength={8} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password_confirm">
          Confirm password
        </label>
        <input id="password_confirm" name="password_confirm" type="password" required minLength={8} className="input" />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-rose-600">
          {state.error}
        </p>
      ) : null}
      <SubmitButton>Create account</SubmitButton>
    </form>
  )
}
