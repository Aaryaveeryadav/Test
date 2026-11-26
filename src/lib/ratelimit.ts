import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Postgres-backed sliding-window rate limiter (atomic via SQL function).
 * Used to protect the signup form and the tutor endpoint.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<{ ok: boolean }> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('rate_limit_hit', {
      p_key: key,
      p_window_seconds: windowSeconds,
      p_max: max
    })
    if (error) {
      console.error('rate_limit_error', error.message)
      return { ok: true } // fail open, but log
    }
    return { ok: Boolean(data) }
  } catch (err) {
    console.error('rate_limit_error', err)
    return { ok: true }
  }
}
