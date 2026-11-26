'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'
import type { ActionState } from '@/lib/types'

export function SubmitButton({
  children,
  variant = 'primary',
  className
}: {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'danger'
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        variant === 'primary' && 'btn-primary',
        variant === 'secondary' && 'btn-secondary',
        variant === 'danger' && 'btn-danger',
        className
      )}
    >
      {pending ? 'Working…' : children}
    </button>
  )
}

/**
 * Form bound to a server action with the standard (prev, formData) signature.
 * Shows validation errors and success messages from the action.
 */
export function ActionForm({
  action,
  submitLabel,
  children,
  className,
  hideButton
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  submitLabel: string
  children?: React.ReactNode
  className?: string
  hideButton?: boolean
}) {
  const [state, formAction] = useActionState(action, {})
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-rose-600">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="mt-2 text-sm font-medium text-emerald-700">
          {state.success}
        </p>
      ) : null}
      {state.data?.invite_path && typeof state.data.invite_path === 'string' ? (
        <input type="hidden" readOnly value={state.data.invite_path} aria-label="Invitation link" />
      ) : null}
      {hideButton ? null : (
        <div className="mt-3">
          <SubmitButton>{submitLabel}</SubmitButton>
        </div>
      )}
    </form>
  )
}

/** Approval action that reveals a one-time temporary password after success. */
export function ApprovalForm({
  action,
  requestId,
  label
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  requestId: string
  label: string
}) {
  const [state, formAction] = useActionState(action, {})
  const temp = typeof state.data?.temp_password === 'string' ? state.data.temp_password : null
  const email = typeof state.data?.email === 'string' ? state.data.email : null
  return (
    <form action={formAction}>
      <input type="hidden" name="request_id" value={requestId} />
      {temp ? (
        <div role="status" className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-semibold">Account created ✓</p>
          <p className="mt-1">
            Email: <code>{email}</code>
            <br />
            One-time password: <code className="font-mono font-bold">{temp}</code>
          </p>
          <p className="mt-1 text-xs">Share it securely and ask the user to change it after first login. It will not be shown again.</p>
        </div>
      ) : null}
      {state.error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-rose-600">
          {state.error}
        </p>
      ) : null}
      {state.success && !temp ? (
        <p role="status" className="mt-2 text-sm font-medium text-emerald-700">
          {state.success}
        </p>
      ) : null}
      <div className="mt-2">
        <SubmitButton variant={temp ? 'secondary' : 'primary'}>{label}</SubmitButton>
      </div>
    </form>
  )
}

/** Invitation creator that reveals the secret signup link after success. */
export function InviteLinkForm({
  action,
  submitLabel,
  schoolId,
  role
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  submitLabel: string
  schoolId?: string
  role?: 'teacher' | 'school_admin'
}) {
  const [state, formAction] = useActionState(action, {})
  const path = typeof state.data?.invite_path === 'string' ? state.data.invite_path : null
  return (
    <form action={formAction} className="space-y-3">
      {schoolId ? <input type="hidden" name="school_id" value={schoolId} /> : null}
      {role ? <input type="hidden" name="role" value={role} /> : null}
      <div>
        <label className="label" htmlFor={`invite-email-${role ?? 't'}`}>
          Email
        </label>
        <input id={`invite-email-${role ?? 't'}`} name="email" type="email" required className="input" placeholder="name@example.com" />
      </div>
      {path ? (
        <div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-semibold">Invitation link (expires in 7 days):</p>
          <code className="mt-1 block break-all font-mono text-xs">
            {typeof window !== 'undefined' ? window.location.origin : ''}
            {path}
          </code>
        </div>
      ) : null}
      {state.error ? <p role="alert" className="text-sm font-medium text-rose-600">{state.error}</p> : null}
      {state.success && !path ? <p role="status" className="text-sm font-medium text-emerald-700">{state.success}</p> : null}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  )
}
