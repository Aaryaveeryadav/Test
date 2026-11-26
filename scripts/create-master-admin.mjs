#!/usr/bin/env node
/**
 * Provision the first MASTER ADMINISTRATOR securely.
 *
 * There is deliberately NO public signup for master admins. This script is run
 * by an operator with direct server access:
 *
 *   node --env-file=.env.local scripts/create-master-admin.mjs admin@example.com 'StrongPassword123!' 'Full Name'
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local. Refuses to create a second
 * master admin unless you pass --force.
 */
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const force = args.includes('--force')
const positional = args.filter((a) => !a.startsWith('--'))
const [email, password, fullName] = positional

if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (use --env-file=.env.local).')
  process.exit(1)
}
if (!email || !password || !fullName) {
  console.error('Usage: node --env-file=.env.local scripts/create-master-admin.mjs <email> <password> <full name> [--force]')
  process.exit(1)
}
if (password.length < 10) {
  console.error('Use a strong password (>= 10 characters). Master admins control the whole platform.')
  process.exit(1)
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const { count, error: countErr } = await admin
  .from('profiles')
  .select('id', { count: 'exact', head: true })
  .eq('role', 'master_admin')
if (countErr) {
  console.error('Could not check existing master admins:', countErr.message)
  process.exit(1)
}
if (count > 0 && !force) {
  console.error(`There are already ${count} master admin(s). Refusing to create another without --force.`)
  process.exit(1)
}

const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName }
})
if (createErr || !created?.user) {
  console.error('Could not create the auth user:', createErr?.message)
  process.exit(1)
}

const { error: profileErr } = await admin.from('profiles').insert({
  id: created.user.id,
  email,
  full_name: fullName,
  role: 'master_admin',
  school_id: null,
  guardian_consent: false
})
if (profileErr) {
  await admin.auth.admin.deleteUser(created.user.id)
  console.error('Could not create the profile:', profileErr.message)
  process.exit(1)
}

console.log(`✔ Master admin created: ${email}`)
console.log('Keep these credentials in your password manager. Never share them in chat or email.')
process.exit(0)
