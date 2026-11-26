'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { activeNavItem, ROLE_ROOT } from '@/lib/nav-config'
import type { Role } from '@/lib/types'

/**
 * Desktop top bar: breadcrumb trail on the left, scope indicator /
 * subject selector in the middle, account chip on the right.
 * The scope controls appear only where a subject choice is meaningful
 * (tutor, practice, subject pages) and update the page context in the URL.
 */
export function TopBar({
  role,
  fullName,
  boardCode,
  grade,
  subjects
}: {
  role: Role
  fullName: string
  boardCode?: string | null
  grade?: number | null
  subjects?: { id: string; name: string }[] | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const params = useSearchParams()
  const root = ROLE_ROOT[role]
  const current = activeNavItem(pathname, role)
  const initial = fullName.trim().charAt(0).toUpperCase() || '•'

  const subjectPageMatch = pathname.match(/^\/student\/subject\/([^/]+)/)
  const scopeRelevant = Boolean(subjectPageMatch) || pathname.startsWith('/student/tutor') || pathname.startsWith('/student/practice')
  const querySubject = params.get('subject')
  const currentSubjectId =
    subjectPageMatch?.[1] ?? (subjects?.some((s) => s.id === querySubject) ? querySubject : subjects?.[0]?.id)

  const changeSubject = (id: string) => {
    if (subjectPageMatch) router.push(`/student/subject/${id}`)
    else router.replace(`${pathname}?subject=${id}`)
  }

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
          {scopeRelevant && subjects && subjects.length > 0 ? (
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

          <span className="flex items-center gap-2 rounded-full border border-stone-200/80 bg-white py-1 pl-1 pr-3 shadow-card">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-rose-600 text-xs font-bold text-white" aria-hidden="true">
              {initial}
            </span>
            <span className="max-w-[10rem] truncate text-sm font-semibold text-stone-800">{fullName}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
