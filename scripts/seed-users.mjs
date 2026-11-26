#!/usr/bin/env node
/**
 * DEMO DATA — clearly marked demo accounts for local development.
 * Do NOT run against a production database.
 *
 *   node --env-file=.env.local scripts/seed-users.mjs
 *
 * Creates (password from DEMO_SEED_PASSWORD, default shown in README):
 *   master@demo.sahayak    — master administrator
 *   admin@demo.sahayak     — school administrator (Demo Public School)
 *   teacher@demo.sahayak   — teacher, Science Class 10
 *   student1..3@demo.sahayak — enrolled students
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('Missing Supabase env vars. Use --env-file=.env.local')
  process.exit(1)
}
const PASSWORD = process.env.DEMO_SEED_PASSWORD || 'ChangeMe-Demo-Only-123'

const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

async function ensureUser({ email, fullName, role, schoolId, extra = {} }) {
  const { data: existingProfile } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  if (existingProfile) {
    console.log(`• profile exists: ${email}`)
    return existingProfile.id
  }
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  })
  if (error) {
    if (error.message.includes('already been registered')) {
      // auth user exists but no profile (e.g. a partially-created account)
      const { data: users } = await admin.from('profiles').select('id').limit(0)
      void users
      console.error(`Auth user ${email} exists without profile. Fix manually.`)
      process.exit(1)
    }
    console.error(`Failed to create ${email}:`, error.message)
    process.exit(1)
  }
  const { error: pErr } = await admin.from('profiles').insert({
    id: created.user.id,
    email,
    full_name: fullName,
    role,
    school_id: schoolId,
    guardian_consent: role === 'student',
    ...extra
  })
  if (pErr) {
    console.error(`Failed profile for ${email}:`, pErr.message)
    process.exit(1)
  }
  console.log(`✔ created: ${email} (${role})`)
  return created.user.id
}

console.log('Seeding DEMO users…')

// The demo school + curriculum must exist first (supabase/seed_demo.sql).
const { data: school } = await admin.from('schools').select('id').eq('code', 'DEMO100').maybeSingle()
if (!school) {
  console.error('Demo school not found. Run the demo seed SQL first (see README → "Load demo data").')
  process.exit(1)
}

const masterId = await ensureUser({ email: 'master@demo.sahayak', fullName: 'Demo Master Admin', role: 'master_admin', schoolId: null })
const adminId = await ensureUser({ email: 'admin@demo.sahayak', fullName: 'Demo School Admin', role: 'school_admin', schoolId: school.id })
const teacherId = await ensureUser({ email: 'teacher@demo.sahayak', fullName: 'R. Sharma', role: 'teacher', schoolId: school.id })
const s1 = await ensureUser({ email: 'student1@demo.sahayak', fullName: 'Aarav Kumar', role: 'student', schoolId: school.id, extra: { roll_number: 'S001', guardian_name: 'Demo Guardian', guardian_contact: 'demo@example.com' } })
const s2 = await ensureUser({ email: 'student2@demo.sahayak', fullName: 'Diya Verma', role: 'student', schoolId: school.id, extra: { roll_number: 'S002', guardian_name: 'Demo Guardian', guardian_contact: 'demo@example.com' } })
const s3 = await ensureUser({ email: 'student3@demo.sahayak', fullName: 'Kabir Singh', role: 'student', schoolId: school.id, extra: { roll_number: 'S003', guardian_name: 'Demo Guardian', guardian_contact: 'demo@example.com' } })
void masterId
void adminId

// Link demo users to the demo class structures (idempotent).
const { data: sc10 } = await admin.from('school_classes').select('id').eq('school_id', school.id).eq('section', 'A').limit(1)
const schoolClass10 = sc10?.[0]?.id
if (!schoolClass10) {
  console.error('Demo class section not found (run seed_demo.sql).')
  process.exit(1)
}
const { data: csRows } = await admin.from('class_subjects').select('id, subject_id, subjects(name)').eq('school_class_id', schoolClass10)
const science = (csRows ?? []).find((r) => r.subjects?.name === 'Science')
if (!science) {
  console.error('Science not offered for the demo class (run seed_demo.sql).')
  process.exit(1)
}

for (const sid of [s1, s2, s3]) {
  await admin.from('enrollments').upsert(
    { school_id: school.id, student_id: sid, school_class_id: schoolClass10 },
    { onConflict: 'student_id,school_class_id', ignoreDuplicates: true }
  )
}
await admin.from('teacher_assignments').upsert(
  { school_id: school.id, teacher_id: teacherId, school_class_id: schoolClass10, subject_id: science.subject_id },
  { onConflict: 'teacher_id,school_class_id,subject_id', ignoreDuplicates: true }
)

// A few demo practice attempts so progress isn't empty.
const { data: topics } = await admin.from('topics').select('id, chapter_id, chapters(subject_id)').limit(6)
for (const t of topics ?? []) {
  for (const [i, sid] of [s1, s2, s3].entries()) {
    const { count } = await admin
      .from('practice_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', sid)
      .eq('topic_id', t.id)
    if (count === 0) {
      await admin.from('practice_attempts').insert({
        student_id: sid,
        subject_id: t.chapters?.subject_id ?? science.subject_id,
        chapter_id: t.chapter_id,
        topic_id: t.id,
        source: 'self',
        question_ref: 'demo-seed',
        correct: (i + t.id.length) % 3 !== 0
      })
    }
  }
}

console.log('\n✔ DEMO users ready.')
console.log(`  Password for all demo accounts: ${PASSWORD}`)
console.log('  master@demo.sahayak / admin@demo.sahayak / teacher@demo.sahayak / student1@demo.sahayak')
console.log('  (Demo data only — delete these accounts before production use.)')
