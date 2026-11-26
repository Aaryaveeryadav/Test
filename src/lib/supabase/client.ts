'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser client — uses the publishable (anon) key only.
 * The browser NEVER talks to the model server or to storage directly;
 * it calls this app's backend (server actions + /api routes).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
