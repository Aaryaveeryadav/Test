'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NAV_GROUPS, ROLE_ROOT } from '@/lib/nav-config'
import { BrandLockup } from '@/components/brand'
import { LangToggle } from '@/components/lang-toggle'
import { DICT, navLabel, t, type DictKey, type Lang } from '@/lib/i18n'
import type { Role } from '@/lib/types'

const GROUP_KEY: Record<string, DictKey> = {
  Learn: 'group_learn',
  Library: 'group_library',
  Teach: 'group_teach',
  Manage: 'group_manage',
  Platform: 'group_platform'
}

export function AppNav({
  role,
  fullName,
  roleLabel,
  schoolName,
  signOut,
  subjectCount,
  lang = 'en'
}: {
  role: Role
  fullName: string
  roleLabel: string
  schoolName: string | null
  signOut: () => Promise<void>
  subjectCount?: number | null
  lang?: Lang
}) {
  const pathname = usePathname()
  const groups = NAV_GROUPS[role] ?? []

  const linkCls = (href: string, match?: string) => {
    const root = ROLE_ROOT[role]
    const active = match
      ? pathname === match || pathname.startsWith(match + '/')
      : pathname === href || (href !== `/${root}` && pathname.startsWith(href + '/'))
    return cn('sidebar-link', active ? 'sidebar-link-active' : 'sidebar-link-idle')
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-stone-200/70 lg:bg-blush-50">
        <div className="px-4 pb-3 pt-5">
          <BrandLockup />
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2" aria-label="Main">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
                {t(lang, GROUP_KEY[group.label] ?? 'group_learn')}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href} className={linkCls(item.href, item.match)}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{navLabel(lang, item.href, item.label)}</span>
                    {item.badge === 'subjects' && subjectCount ? (
                      <span className="rounded-full bg-blush-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                        {subjectCount}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-stone-200/70 p-3">
          {schoolName ? (
            <p className="truncate text-xs font-semibold text-stone-700" title={schoolName}>
              {schoolName}
            </p>
          ) : (
            <p className="text-xs font-semibold text-stone-700">Platform administration</p>
          )}
          <p className="mt-1 truncate text-xs text-stone-500">{fullName}</p>
          <p className="text-xs text-stone-400">{roleLabel}</p>
          <LangToggle lang={lang} className="mt-2" />
          <form action={signOut}>
            <button type="submit" className="mt-2 block text-xs font-semibold text-rose-600 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-20 border-b border-stone-200/70 bg-blush-50 lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <BrandLockup compact />
          <form action={signOut}>
            <button type="submit" className="text-sm font-semibold text-rose-600">
              Sign out
            </button>
          </form>
        </div>
        <nav className="flex gap-1.5 overflow-x-auto px-3 pb-2" aria-label="Main">
          {groups.flatMap((g) => g.items).map((l) => {
            const root = ROLE_ROOT[role]
            const active =
              ('match' in l && l.match ? pathname === l.match || pathname.startsWith(l.match + '/') : false) ||
              pathname === l.href ||
              (l.href !== `/${root}` && pathname.startsWith(l.href + '/'))
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
                  active ? 'bg-white text-stone-900 shadow-card ring-1 ring-rose-300' : 'text-stone-500'
                )}
              >
                <l.icon className="h-3.5 w-3.5" />
                {l.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}
