'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { audit } from '@/lib/audit'
import { genTempPassword, num, optStr, str } from '@/lib/form'
import type { ActionState } from '@/lib/types'

/** Approve a pending access request → creates the auth user + trusted profile. */
export async function approveRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('school_admin', 'master_admin')
  const requestId = str(formData, 'request_id')

  const admin = createAdminClient()
  const { data: request } = await admin
    .from('signup_requests')
    .select('id, school_id, requested_role, requested_class_id, email, full_name, roll_number, guardian_name, guardian_contact, guardian_consent, status')
    .eq('id', requestId)
    .maybeSingle()
  if (!request) return { error: 'Request not found.' }
  if (profile.role === 'school_admin' && request.school_id !== profile.school_id) {
    return { error: 'This request belongs to another school.' }
  }
  if (request.status !== 'pending') return { error: 'This request was already reviewed.' }

  const tempPassword = genTempPassword()
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: request.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: request.full_name }
  })
  if (createErr || !created?.user) {
    const msg = createErr?.message ?? ''
    if (msg.includes('already been registered')) {
      return { error: 'An account with this email already exists. Reject the request and ask the person to request a password reset instead.' }
    }
    return { error: `Could not create the account: ${msg}` }
  }

  const { error: profileErr } = await admin.from('profiles').insert({
    id: created.user.id,
    email: request.email,
    full_name: request.full_name,
    role: request.requested_role,
    school_id: request.school_id,
    roll_number: request.roll_number,
    guardian_name: request.guardian_name,
    guardian_contact: request.guardian_contact,
    guardian_consent: request.guardian_consent
  })
  if (profileErr) {
    try {
      await admin.auth.admin.deleteUser(created.user.id)
    } catch {
      /* ignore */
    }
    return { error: 'Could not create the profile. Please try again.' }
  }

  // Students: enroll into the school's class matching the requested class
  // (first active section). If none matches, the admin can enroll manually.
  let enrolled = false
  if (request.requested_role === 'student' && request.requested_class_id) {
    const { data: sc } = await admin
      .from('school_classes')
      .select('id')
      .eq('school_id', request.school_id)
      .eq('class_id', request.requested_class_id)
      .eq('status', 'active')
      .order('section')
      .limit(1)
    if (sc?.[0]) {
      const { error: enrollErr } = await admin.from('enrollments').insert({
        school_id: request.school_id,
        student_id: created.user.id,
        school_class_id: sc[0].id
      })
      enrolled = !enrollErr
    }
  }

  await admin
    .from('signup_requests')
    .update({ status: 'approved', reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
    .eq('id', requestId)

  await audit({
    actorId: profile.id,
    schoolId: request.school_id,
    action: 'users.approved',
    entity: 'signup_requests',
    entityId: requestId,
    details: { role: request.requested_role, enrolled }
  })

  revalidatePath('/admin/approvals')
  return {
    success: enrolled
      ? 'Account created and the student was enrolled into their requested class. Share this one-time password securely and ask them to change it after first login.'
      : 'Account created. Share this one-time password securely and ask them to change it after first login.',
    data: { email: request.email, temp_password: tempPassword }
  }
}

export async function rejectRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('school_admin', 'master_admin')
  const requestId = str(formData, 'request_id')
  const admin = createAdminClient()
  const { data: request } = await admin
    .from('signup_requests')
    .select('id, school_id')
    .eq('id', requestId)
    .maybeSingle()
  if (!request) return { error: 'Request not found.' }
  if (profile.role === 'school_admin' && request.school_id !== profile.school_id) {
    return { error: 'This request belongs to another school.' }
  }
  await admin
    .from('signup_requests')
    .update({ status: 'rejected', reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
    .eq('id', requestId)
  await audit({
    actorId: profile.id,
    schoolId: request.school_id,
    action: 'users.rejected',
    entity: 'signup_requests',
    entityId: requestId
  })
  revalidatePath('/admin/approvals')
  return { success: 'Request rejected.' }
}

/** Create a teacher invitation (secret link). School admins use this for teachers. */
export async function createInvitation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('school_admin')
  const email = str(formData, 'email').toLowerCase()
  const fullName = optStr(formData, 'full_name') ?? ''
  if (!email.includes('@')) return { error: 'Please enter a valid email.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('invitations')
    .insert({ school_id: profile.school_id, role: 'teacher', email, full_name: fullName, created_by: profile.id })
    .select('token')
    .single()
  if (error || !data) return { error: 'Could not create the invitation.' }

  await audit({
    actorId: profile.id,
    schoolId: profile.school_id,
    action: 'invitations.created',
    entity: 'invitations',
    entityId: data.token,
    details: { role: 'teacher' }
  })
  revalidatePath('/admin/approvals')
  return {
    success: 'Invitation created. Share this secret link — it expires in 7 days.',
    data: { invite_path: `/signup?invite=${data.token}` }
  }
}

export async function revokeInvitation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('school_admin')
  const id = str(formData, 'invitation_id')
  const admin = createAdminClient()
  await admin
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('school_id', profile.school_id)
    .eq('status', 'pending')
  revalidatePath('/admin/approvals')
  return { success: 'Invitation revoked.' }
}

// ---------------------------------------------------------------------------
// School structure: classes, subjects offered, enrollments, teacher assignments
// ---------------------------------------------------------------------------

export async function upsertSchoolClass(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('school_admin')
  const classId = str(formData, 'class_id')
  const section = str(formData, 'section') || 'A'
  const academicYear = str(formData, 'academic_year') || String(new Date().getFullYear())
  if (!classId) return { error: 'Choose a class.' }

  const admin = createAdminClient()
  // The offered class must belong to the school's board.
  const { data: school } = await admin.from('schools').select('board_id').eq('id', profile.school_id).maybeSingle()
  const { data: cls } = await admin.from('classes').select('id, board_id, grade, label').eq('id', classId).maybeSingle()
  if (!cls) return { error: 'Class not found in the curriculum.' }
  if (school?.board_id && cls.board_id !== school.board_id) {
    return { error: 'That class belongs to a different board than your school.' }
  }

  const { error } = await admin.from('school_classes').insert({
    school_id: profile.school_id,
    class_id: classId,
    section,
    academic_year: academicYear
  })
  if (error) return { error: 'Could not create the class section (it may already exist).' }
  await audit({
    actorId: profile.id,
    schoolId: profile.school_id,
    action: 'school_classes.created',
    entity: 'school_classes',
    details: { class_id: classId, section }
  })
  revalidatePath('/admin/classes')
  return { success: 'Class section created.' }
}

export async function upsertClassSubject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('school_admin')
  const schoolClassId = str(formData, 'school_class_id')
  const subjectId = str(formData, 'subject_id')
  const admin = createAdminClient()
  const { data: sc } = await admin
    .from('school_classes')
    .select('id, class_id')
    .eq('id', schoolClassId)
    .eq('school_id', profile.school_id)
    .maybeSingle()
  if (!sc) return { error: 'Class section not found.' }
  const { data: subject } = await admin
    .from('subjects')
    .select('id, class_id')
    .eq('id', subjectId)
    .maybeSingle()
  if (!subject || subject.class_id !== sc.class_id) {
    return { error: 'That subject does not belong to this class.' }
  }
  const { error } = await admin.from('class_subjects').insert({
    school_id: profile.school_id,
    school_class_id: schoolClassId,
    subject_id: subjectId
  })
  if (error) return { error: 'Subject already added to this class section.' }
  revalidatePath('/admin/classes')
  return { success: 'Subject offered.' }
}

export async function enrollStudent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('school_admin')
  const studentId = str(formData, 'student_id')
  const schoolClassId = str(formData, 'school_class_id')
  const admin = createAdminClient()
  const { data: student } = await admin
    .from('profiles')
    .select('id, role, school_id')
    .eq('id', studentId)
    .eq('school_id', profile.school_id)
    .eq('role', 'student')
    .maybeSingle()
  if (!student) return { error: 'Student not found in your school.' }
  const { data: sc } = await admin
    .from('school_classes')
    .select('id')
    .eq('id', schoolClassId)
    .eq('school_id', profile.school_id)
    .maybeSingle()
  if (!sc) return { error: 'Class section not found.' }
  const { error } = await admin.from('enrollments').insert({
    school_id: profile.school_id,
    student_id: studentId,
    school_class_id: schoolClassId
  })
  if (error) return { error: 'Student is already enrolled in this section.' }
  revalidatePath('/admin/classes')
  return { success: 'Student enrolled.' }
}

export async function assignTeacher(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('school_admin')
  const teacherId = str(formData, 'teacher_id')
  const schoolClassId = str(formData, 'school_class_id')
  const subjectId = str(formData, 'subject_id')
  const admin = createAdminClient()
  const { data: teacher } = await admin
    .from('profiles')
    .select('id, role, school_id')
    .eq('id', teacherId)
    .eq('school_id', profile.school_id)
    .eq('role', 'teacher')
    .maybeSingle()
  if (!teacher) return { error: 'Teacher not found in your school.' }
  const { data: cs } = await admin
    .from('class_subjects')
    .select('id')
    .eq('school_class_id', schoolClassId)
    .eq('subject_id', subjectId)
    .eq('school_id', profile.school_id)
    .maybeSingle()
  if (!cs) return { error: 'That subject is not offered for this class section — add it first.' }
  const { error } = await admin.from('teacher_assignments').insert({
    school_id: profile.school_id,
    teacher_id: teacherId,
    school_class_id: schoolClassId,
    subject_id: subjectId
  })
  if (error) return { error: 'This teacher already has that assignment.' }
  await audit({
    actorId: profile.id,
    schoolId: profile.school_id,
    action: 'teacher_assignments.created',
    entity: 'teacher_assignments',
    details: { teacher_id: teacherId, school_class_id: schoolClassId, subject_id: subjectId }
  })
  revalidatePath('/admin/classes')
  return { success: 'Teacher assigned.' }
}

/** Deactivate/reactivate a user in the same school (also bans/unbans sessions). */
export async function setUserStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('school_admin', 'master_admin')
  const userId = str(formData, 'user_id')
  const status = str(formData, 'status') === 'inactive' ? 'inactive' : 'active'
  if (userId === profile.id) return { error: 'You cannot deactivate your own account.' }

  const admin = createAdminClient()
  const { data: target } = await admin
    .from('profiles')
    .select('id, role, school_id, email')
    .eq('id', userId)
    .maybeSingle()
  if (!target) return { error: 'User not found.' }
  if (target.role === 'master_admin') return { error: 'Master admin accounts can only be managed by other master admins via secure provisioning.' }
  if (profile.role === 'school_admin' && target.school_id !== profile.school_id) {
    return { error: 'This user belongs to another school.' }
  }

  await admin.from('profiles').update({ status }).eq('id', userId)
  // Kill live sessions too: ban (which revokes refresh tokens) or unban.
  try {
    await admin.auth.admin.updateUserById(userId, {
      ban_duration: status === 'inactive' ? '876000h' : 'none'
    })
  } catch {
    // profile status still applies on next request via middleware
  }
  await audit({
    actorId: profile.id,
    schoolId: target.school_id,
    action: status === 'inactive' ? 'users.deactivated' : 'users.reactivated',
    entity: 'profiles',
    entityId: userId,
    details: { role: target.role }
  })
  revalidatePath('/admin/users')
  revalidatePath('/master/schools')
  return { success: status === 'inactive' ? 'User deactivated — access revoked, including live sessions.' : 'User reactivated.' }
}
