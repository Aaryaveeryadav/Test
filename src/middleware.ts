import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/', '/login', '/signup', '/suspended', '/privacy', '/api/school-classes']
const ROLE_AREA: Record<string, string> = {
  master_admin: '/master',
  school_admin: '/admin',
  teacher: '/teacher',
  student: '/student'
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // App not configured yet (no env vars): let pages through; they show a setup notice.
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.next()

  let response = NextResponse.next({ request })
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      }
    }
  })

  // NOTE: getUser() (not getSession()) — validates the JWT with the server.
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData?.user ?? null
  const { pathname } = request.nextUrl

  // Degraded mode: the auth server is unreachable but a session cookie exists.
  // Let the request through — server pages do their own authorization and will
  // surface a clear error instead of trapping the user in a redirect loop.
  const hasSessionCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'))
  if (userError && hasSessionCookie) return response

  if (!user) {
    if (PUBLIC_PATHS.includes(pathname)) return response
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Role, account status and school status always come from trusted server records.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, status, school_id, schools(status)')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) return response // degraded mode — page-level checks apply

  if (!profile) {
    // Auth user without an approved profile — reject and sign out.
    try {
      await supabase.auth.signOut()
    } catch {
      /* ignore */
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'no_profile')
    return NextResponse.redirect(url)
  }

  const schoolStatus = (profile.schools as { status?: string } | null)?.status
  if (profile.status !== 'active' || schoolStatus === 'suspended') {
    if (pathname !== '/suspended') {
      const url = request.nextUrl.clone()
      url.pathname = '/suspended'
      return NextResponse.redirect(url)
    }
    return response
  }

  const area = ROLE_AREA[profile.role]
  // Area guards: /student, /teacher, /admin, /master and the tutor API.
  const restricted =
    (pathname.startsWith('/student') || pathname.startsWith('/teacher') ||
      pathname.startsWith('/admin') || pathname.startsWith('/master')) ||
    (pathname.startsWith('/api/tutor') && profile.role !== 'student')

  if (restricted && !pathname.startsWith(area)) {
    const url = request.nextUrl.clone()
    url.pathname = area
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)'
  ]
}
