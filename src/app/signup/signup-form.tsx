'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { requestAccess, completeInvite } from '@/actions/auth-actions'
import { SubmitButton } from '@/components/action-form'

export function RequestAccessForm() {
  const [state, formAction] = useActionState(requestAccess, {})
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [schoolCode, setSchoolCode] = useState('')
  const [schoolName, setSchoolName] = useState<string | null>(null)
  const [classOptions, setClassOptions] = useState<{ id: string; label: string }[]>([])
  const [classesLoading, setClassesLoading] = useState(false)

  // Look up the school's offered classes as soon as a plausible code is typed.
  useEffect(() => {
    const code = schoolCode.trim().toUpperCase()
    if (!/^[A-Z0-9-]{3,20}$/.test(code)) {
      setSchoolName(null)
      setClassOptions([])
      return
    }
    let cancelled = false
    setClassesLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/school-classes?code=${encodeURIComponent(code)}`)
        if (!res.ok) throw new Error('bad response')
        const data = (await res.json()) as { school: { name: string } | null; classes: { id: string; label: string }[] }
        if (!cancelled) {
          setSchoolName(data.school?.name ?? null)
          setClassOptions(data.classes ?? [])
        }
      } catch {
        if (!cancelled) {
          setSchoolName(null)
          setClassOptions([])
        }
      } finally {
        if (!cancelled) setClassesLoading(false)
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [schoolCode])

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
        <input
          id="school_code"
          name="school_code"
          required
          className="input uppercase"
          placeholder="e.g. DEMO100"
          value={schoolCode}
          onChange={(e) => setSchoolCode(e.target.value)}
        />
        {schoolName ? (
          <p className="mt-1 text-xs font-semibold text-emerald-700">✓ {schoolName}</p>
        ) : (
          <p className="mt-1 text-xs text-slate-400">Ask your school office for this code.</p>
        )}
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
          <div>
            <label className="label" htmlFor="class_id">
              Class <span className="text-rose-600">*</span>
            </label>
            <select id="class_id" name="class_id" required className="input" disabled={classOptions.length === 0}>
              <option value="">
                {classesLoading ? 'Checking school code…' : classOptions.length === 0 ? 'Enter a valid school code first' : 'Choose your class'}
              </option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Only classes your school offers are listed. The school confirms your section when approving.
            </p>
          </div>
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
              <a href="/privacy" target="_blank" className="font-semibold text-rose-600 underline">
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
