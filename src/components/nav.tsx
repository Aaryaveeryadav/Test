'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpen,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  Library,
  ListChecks,
  MessageCircleQuestion,
  Scale,
  School,
  Settings,
  TrendingUp,
  UserCog,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Role } from '@/lib/types'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV: Record<Role, NavItem[]> = {
  student: [
    { href: '/student', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/student/tutor', label: 'Ask the Tutor', icon: MessageCircleQuestion },
    { href: '/student/practice', label: 'Practice', icon: ListChecks },
    { href: '/student/assignments', label: 'Assignments', icon: ClipboardCheck },
    { href: '/student/progress', label: 'My Progress', icon: TrendingUp }
  ],
  teacher: [
    { href: '/teacher', label: 'My Classes', icon: LayoutDashboard },
    { href: '/teacher/assignments', label: 'Assignments', icon: ClipboardCheck },
    { href: '/teacher/topics', label: 'Topic Planning', icon: ListChecks },
    { href: '/teacher/notes', label: 'Notes & Practice', icon: BookOpen },
    { href: '/teacher/review', label: 'Review Flags', icon: Scale }
  ],
  school_admin: [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/approvals', label: 'Approvals & Invites', icon: UserCog },
    { href: '/admin/classes', label: 'Classes & Enrollments', icon: School },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/audit', label: 'Audit Log', icon: FileText }
  ],
  master_admin: [
    { href: '/master', label: 'Overview', icon: LayoutDashboard },
    { href: '/master/schools', label: 'Schools', icon: School },
    { href: '/master/curriculum/boards', label: 'Curriculum', icon: Library },
    { href: '/master/documents', label: 'Books & Documents', icon: FileText },
    { href: '/master/audit', label: 'Audit Log', icon: FileText }
  ]
}

export function AppNav({
  role,
  fullName,
  roleLabel,
  schoolName,
  signOut
}: {
  role: Role
  fullName: string
  roleLabel: string
  schoolName: string | null
  signOut: () => Promise<void>
}) {
  const pathname = usePathname()
  const links = NAV[role] ?? []
  const isActive = (href: string) => pathname === href || (href !== `/${role === 'school_admin' ? 'admin' : role}` && pathname.startsWith(href + '/')) || (href.endsWith('/boards') && pathname.startsWith('/master/curriculum/'))

  const linkCls = (active: boolean) =>
    cn(
      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-60 lg:flex-col lg:border-r lg:bg-white">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <GraduationCap className="h-6 w-6 text-indigo-600" />
          <span className="text-lg font-extrabold tracking-tight text-slate-900">Sahayak</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkCls(isActive(l.href))}>
              <l.icon className="h-4 w-4 shrink-0" />
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-3">
          {schoolName ? (
            <p className="truncate text-xs font-semibold text-slate-700" title={schoolName}>
              <Landmark className="mr-1 inline h-3 w-3" />
              {schoolName}
            </p>
          ) : (
            <p className="text-xs font-semibold text-slate-700">Platform administration</p>
          )}
          <p className="mt-1 truncate text-xs text-slate-500">{fullName}</p>
          <p className="text-xs text-slate-400">{roleLabel}</p>
          <form action={signOut}>
            <button type="submit" className="mt-2 text-xs font-semibold text-rose-600 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-20 border-b bg-white lg:hidden">
        <div className="flex h-12 items-center justify-between px-4">
          <span className="flex items-center gap-1.5 font-extrabold tracking-tight text-slate-900">
            <GraduationCap className="h-5 w-5 text-indigo-600" />
            Sahayak
          </span>
          <form action={signOut}>
            <button type="submit" className="text-sm font-semibold text-rose-600">
              Sign out
            </button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
                isActive(l.href) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
              )}
            >
              <l.icon className="h-3.5 w-3.5" />
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  )
}
