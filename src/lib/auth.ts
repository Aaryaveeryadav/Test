import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROLE_HOME, type Profile, type Role } from '@/lib/types'

/** Read the trusted profile for the signed-in user (null if not signed in). */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, school_id, status, roll_number, guardian_consent, created_at')
    .eq('id', user.id)
    .maybeSingle()
  if (!data) return null
  return data as Profile
}

/** Require any signed-in user with an approved profile. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  return profile
}

/** Require one of the given roles. Role always comes from the server record. */
export async function requireRole(...roles: Role[]): Promise<Profile> {
  const profile = await requireProfile()
  if (!roles.includes(profile.role)) redirect(ROLE_HOME[profile.role])
  return profile
}
