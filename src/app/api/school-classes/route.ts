import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

/**
 * Public signup aid: given a school code, return the school's name and the
 * classes it offers so students can pick their class on the request form.
 * Returns empty (not an error) for unknown/inactive codes — the server action
 * re-validates everything on submit.
 */
export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get('code') ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9-]{3,20}$/.test(code)) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { ok } = await rateLimit(`school-classes:${ip}`, 30, 300)
  if (!ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const admin = createAdminClient()
  const { data: school } = await admin
    .from('schools')
    .select('id, name, status')
    .eq('code', code)
    .maybeSingle()
  if (!school || school.status !== 'active') {
    return NextResponse.json({ school: null, classes: [] })
  }

  const { data: rows } = await admin
    .from('school_classes')
    .select('id, class_id, classes(id, grade, label, status)')
    .eq('school_id', school.id)
    .eq('status', 'active')

  const seen = new Set<string>()
  const classes = (rows ?? [])
    .map((r) => r.classes as unknown as { id: string; grade: number; label: string | null; status: string } | null)
    .filter((c): c is { id: string; grade: number; label: string | null; status: string } =>
      Boolean(c) && c!.status === 'active' && !seen.has(c!.id) && (seen.add(c!.id), true)
    )
    .sort((a, b) => a.grade - b.grade)
    .map((c) => ({ id: c.id, label: c.label ?? `Class ${c.grade}` }))

  return NextResponse.json({ school: { name: school.name }, classes })
}
