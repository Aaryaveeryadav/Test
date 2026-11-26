'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/ratelimit'
import { audit } from '@/lib/audit'
import { bool, genTempPassword, optStr, str } from '@/lib/form'
import type { ActionState } from '@/lib/types'

/**
 * Access request form (public). Students and teacher-candidates submit this;
 * a school administrator must approve before an account is created. No one
 * becomes a teacher by selecting "Teacher" in a signup form.
 */
export async function requestAccess(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const schoolCode = str(formData, 'school_code').toUpperCase()
  const requestedRole = str(formData, 'requested_role') === 'teacher' ? 'teacher' : 'student'
  const fullName = str(formData, 'full_name')
  const email = str(formData, 'email').toLowerCase()
  const rollNumber = optStr(formData, 'roll_number')
  const guardianName = optStr(formData, 'guardian_name')
  const guardianContact = optStr(formData, 'guardian_contact')
  const guardianConsent = bool(formData, 'guardian_consent')
  const note = optStr(formData, 'note')

  if (!schoolCode || fullName.length < 2 || !email.includes('@')) {
    return { error: 'Please fill in your name, a valid email, and your school code.' }
  }
  if (fullName.length > 80 || email.length > 120) {
    return { error: 'Name or email is too long.' }
  }
  if (requestedRole === 'student') {
    if (!rollNumber) return { error: 'Roll number is required for students (used for school verification).' }
    if (!guardianConsent) {
      return { error: 'Guardian consent is required for student accounts. Please ask your parent/guardian to review and tick the consent box.' }
    }
  }

  const { ok } = await rateLimit(`access_request:${email}`, 3, 3600)
  if (!ok) return { error: 'Too many requests from this email. Please try again in an hour.' }

  const admin = createAdminClient()
  const { data: school } = await admin
    .from('schools')
    .select('id, name, status')
    .eq('code', schoolCode)
    .maybeSingle()
  if (!school) return { error: 'School code not found. Please check the code with your school office.' }
  if (school.status !== 'active') {
    return { error: 'This school is not accepting new requests right now.' }
  }

  const { data: dup } = await admin
    .from('signup_requests')
    .select('id')
    .eq('school_id', school.id)
    .eq('email', email)
    .eq('status', 'pending')
    .maybeSingle()
  if (dup) return { error: 'A request with this email is already pending review by your school.' }

  const { error } = await admin.from('signup_requests').insert({
    school_id: school.id,
    requested_role: requestedRole,
    email,
    full_name: fullName,
    roll_number: requestedRole === 'student' ? rollNumber : null,
    guardian_name: requestedRole === 'student' ? guardianName : null,
    guardian_contact: requestedRole === 'student' ? guardianContact : null,
    guardian_consent: requestedRole === 'student' ? guardianConsent : false,
    note
  })
  if (error) return { error: 'Could not submit your request. Please try again.' }

  return {
    success:
      `Request submitted to ${school.name}. Your school administrator will review it — ` +
      (requestedRole === 'teacher'
        ? 'teachers are contacted with login details after approval or via an invitation link.'
        : 'you will get your login details after approval.')
  }
}

/**
 * Redeem a staff invitation (secret link created by a school or master admin).
 */
export async function completeInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = str(formData, 'token')
  const fullName = str(formData, 'full_name')
  const password = str(formData, 'password')
  const confirm = str(formData, 'password_confirm')

  if (!token) return { error: 'Invalid invitation link.' }
  if (fullName.length < 2) return { error: 'Please enter your full name.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (password !== confirm) return { error: 'Passwords do not match.' }

  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('invitations')
    .select('id, school_id, role, email, status, expires_at')
    .eq('token', token)
    .maybeSingle()
  if (!invite || invite.status !== 'pending') return { error: 'This invitation is no longer valid.' }
  if (new Date(invite.expires_at).getTime() < Date.now()) return { error: 'This invitation has expired. Ask your administrator for a new one.' }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  })
  if (createErr || !created?.user) {
    const msg = createErr?.message ?? ''
    if (msg.includes('already been registered') || msg.includes('already exists')) {
      return { error: 'An account with this email already exists. Please sign in instead.' }
    }
    return { error: 'Could not create the account. Please try again later.' }
  }

  const { error: profileErr } = await admin.from('profiles').insert({
    id: created.user.id,
    email: invite.email,
    full_name: fullName,
    role: invite.role,
    school_id: invite.school_id,
    guardian_consent: false
  })
  if (profileErr) {
    // Roll back the auth user so the invitation can be retried.
    try {
      await admin.auth.admin.deleteUser(created.user.id)
    } catch {
      /* ignore */
    }
    return { error: 'Could not finish setup. Please try again later.' }
  }

  await admin.from('invitations').update({ status: 'used' }).eq('id', invite.id)
  await audit({
    actorId: created.user.id,
    schoolId: invite.school_id,
    action: 'auth.invite_redeemed',
    entity: 'invitations',
    entityId: invite.id,
    details: { role: invite.role }
  })

  return { success: 'Account created! You can sign in now with your email and password.', data: { login: '1' } }
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
