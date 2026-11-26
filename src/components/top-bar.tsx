'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, LogOut, Sparkles } from 'lucide-react'
import { activeNavItem, ROLE_ROOT } from '@/lib/nav-config'
import { t, type Lang } from '@/lib/i18n'
import type { Role } from '@/lib/types'

/**
 * Desktop top bar: breadcrumb trail on the left; board/class/subject scope
 * selector, "Show me the ways" and account chip on the right.
 * For students the scope chips are always visible (like the reference app):
 * the subject selector jumps to that subject's page, or updates tutor/practice
 * in place. Ctrl/Cmd+K opens the tutor from anywhere.
 * Clicking the account chip opens a small menu with the signed-out action.
 */
export function TopBar({
  role,
  fullName,
  roleLabel,
  signOut,
  boardCode,
  grade,
  subjects,
  lang = 'en'
}: {
  role: Role
  fullName: string
  roleLabel: string
  signOut: () => Promise<void>
  boardCode?: string | null
  grade?: number | null
  subjects?: { id: string; name: string }[] | null
  lang?: Lang
}) {
  const pathname = usePathname()
  const router = useRouter()
  const params = useSearchParams()
  const root = ROLE_ROOT[role]
  const current = activeNavItem(pathname, role)
  const initial = fullName.trim().charAt(0).toUpperCase() || '•'

  const isStudent = role === 'student'
  const subjectPageMatch = pathname.match(/^\/student\/subject\/([^/]+)/)
  const inScopeContext =
    Boolean(subjectPageMatch) || pathname.startsWith('/student/tutor') || pathname.startsWith('/student/practice')
  const querySubject = params.get('subject')
  const currentSubjectId =
    subjectPageMatch?.[1] ??
    (subjects?.some((s) => s.id === querySubject) ? querySubject : subjects?.[0]?.id)

  const changeSubject = (id: string) => {
    if (subjectPageMatch) router.push(`/student/subject/${id}`)
    else if (inScopeContext) router.replace(`${pathname}?subject=${id}`)
    else router.push(`/student/subject/${id}`)
  }

  // Ctrl/Cmd+K → open the tutor ("Show me the ways").
  useEffect(() => {
    if (!isStudent) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        router.push('/student/tutor')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isStudent, router])

  // Account menu: close when clicking outside the chip.
  const accountRef = useRef<HTMLDetailsElement>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  return (
    <div className="sticky top-0 z-20 hidden border-b border-stone-200/70 bg-cream/90 backdrop-blur md:block">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-6">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
          <Link href={`/${root}`} className="font-medium text-stone-500 hover:text-stone-800">
            Home
          </Link>
          {current && current.href !== `/${root}` ? (
            <>
              <span className="text-stone-300" aria-hidden="true">
                /
              </span>
              <span className="truncate font-semibold text-stone-800">{current.label}</span>
            </>
          ) : null}
        </nav>

        <div className="flex items-center gap-2">
          {isStudent && subjects && subjects.length > 0 ? (
            <>
              {boardCode ? (
                <span className="scope-select" title="Board">
                  <span className="scope-label">Board</span>
                  <span className="scope-value">{boardCode}</span>
                </span>
              ) : null}
              {grade ? (
                <span className="scope-select" title="Class">
                  <span className="scope-label">Class</span>
                  <span className="scope-value">{grade}</span>
                </span>
              ) : null}
              <label className="scope-select">
                <span className="scope-label">Subject</span>
                <select
                  value={currentSubjectId ?? ''}
                  onChange={(e) => changeSubject(e.target.value)}
                  className="cursor-pointer bg-transparent pr-1 font-semibold text-stone-800 focus:outline-none"
                  aria-label="Choose subject"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {isStudent ? (
            <button
              type="button"
              onClick={() => router.push('/student/tutor')}
              title="Ctrl/Cmd + K"
              className="flex items-center gap-1.5 rounded-xl border border-stone-200/80 bg-white py-1.5 pl-3 pr-2.5 text-sm font-semibold text-stone-700 shadow-card transition-all hover:shadow-pop hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <Sparkles className="h-4 w-4 text-rose-600" aria-hidden="true" />
              {t(lang, 'show_ways')}
              <kbd className="rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] font-bold text-stone-400">
                Ctrl K
              </kbd>
            </button>
          ) : null}

          <details
            ref={accountRef}
            open={accountOpen}
            onToggle={(e) => setAccountOpen((e.target as HTMLDetailsElement).open)}
            className="relative"
          >
            <summary
              className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-stone-200/80 bg-white py-1 pl-1 pr-2.5 shadow-card transition-all hover:shadow-pop [&::-webkit-details-marker]:hidden"
              aria-haspopup="menu"
              title={fullName}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-rose-600 text-xs font-bold text-white" aria-hidden="true">
                {initial}
              </span>
              <span className="max-w-[10rem] truncate text-sm font-semibold text-stone-800">{fullName}</span>
              <ChevronDown className="h-3.5 w-3.5 text-stone-400" aria-hidden="true" />
            </summary>
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+8px)] w-56 rounded-2xl border border-stone-200/80 bg-white p-1.5 shadow-pop"
            >
              <div className="border-b border-stone-100 px-3 pb-2 pt-1.5">
                <p className="truncate text-sm font-semibold text-stone-800">{fullName}</p>
                <p className="mt-0.5 text-xs text-stone-500">{roleLabel}</p>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  role="menuitem"
                  className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-blush-50"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {t(lang, 'sign_out')}
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
