#!/usr/bin/env node
/**
 * Retention cleanup — run on a schedule (cron / Supabase scheduled function):
 *   node --env-file=.env.local scripts/retention-cleanup.mjs
 *
 * Deletes:
 *  - chats & messages older than each school's configured retention window
 *    (schools.settings.retention_days, default DEFAULT_RETENTION_DAYS/90)
 *  - stale rate-limit rows older than 30 days
 *
 * Never deletes audit logs, practice attempts or assignment records — those are
 * the system of record for progress. Student chats are never used for training.
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('Missing Supabase env vars. Use --env-file=.env.local')
  process.exit(1)
}
const DEFAULT_DAYS = Number(process.env.DEFAULT_RETENTION_DAYS || 90)

const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: schools, error } = await admin.from('schools').select('id, name, settings')
if (error) {
  console.error('Could not list schools:', error.message)
  process.exit(1)
}

let deletedChats = 0
for (const school of schools ?? []) {
  const days = Number(school.settings?.retention_days ?? DEFAULT_DAYS)
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error: delErr } = await admin
    .from('chats')
    .delete()
    .eq('school_id', school.id)
    .lt('last_message_at', cutoff)
    .select('id')
  if (delErr) {
    console.error(`Cleanup failed for ${school.name}:`, delErr.message)
    continue
  }
  deletedChats += data?.length ?? 0
  if (data?.length) console.log(`• ${school.name}: deleted ${data.length} chats older than ${days} days`)
}

const { data: staleLimits } = await admin
  .from('rate_limits')
  .delete()
  .lt('window_start', new Date(Date.now() - 30 * 86_400_000).toISOString())
  .select('key')
console.log(`• rate_limits: removed ${staleLimits?.length ?? 0} stale windows`)

console.log(`✔ Retention cleanup done. Deleted ${deletedChats} chats total.`)
