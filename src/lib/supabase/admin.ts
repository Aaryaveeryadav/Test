import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role client — SERVER ONLY. Bypasses RLS, so every call site MUST
 * perform explicit role/school checks (see src/lib/auth.ts and src/actions/*).
 * Used for: admin user provisioning, school-scoped writes, audit logs,
 * retrieval (RAG) and rate limiting.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.'
    )
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}
