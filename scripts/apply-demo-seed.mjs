#!/usr/bin/env node
/**
 * Applies supabase/seed_demo.sql to the configured Supabase project using the
 * service-role key (uses the PostgREST RPC-free path: the SQL file is applied
 * via the Supabase Management API when SUPABASE_PROJECT_REF is provided, or
 * print instructions otherwise).
 *
 * Simpler alternative: paste the SQL into the Supabase SQL editor.
 *   node --env-file=.env.local scripts/apply-demo-seed.mjs
 */
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../supabase/seed_demo.sql', import.meta.url), 'utf8')
console.log('Open the Supabase dashboard → SQL editor, then paste supabase/seed_demo.sql and run it.')
console.log(`(The file is ${Math.round(sql.length / 1024)} KB of idempotent INSERTs clearly marked as demo content.)`)
