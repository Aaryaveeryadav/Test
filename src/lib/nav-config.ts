import {
  BookOpen,
  ClipboardCheck,
  FileText,
  Home,
  Layers,
  LayoutDashboard,
  Library,
  ListChecks,
  MessageCircleQuestion,
  Scale,
  School,
  TrendingUp,
  UserCog,
  Users
} from 'lucide-react'
import type { Role } from '@/lib/types'

export interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** Treat as active when the pathname starts with this prefix (for section roots). */
  match?: string
  /** Optional dynamic badge rendered on the item. */
  badge?: 'subjects'
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const ROLE_ROOT: Record<Role, string> = {
  student: 'student',
  teacher: 'teacher',
  school_admin: 'admin',
  master_admin: 'master'
}

export const NAV_GROUPS: Record<Role, NavGroup[]> = {
  student: [
    {
      label: 'Learn',
      items: [
        { href: '/student', label: 'Home', icon: Home },
        { href: '/student/tutor', label: 'Ask a question', icon: MessageCircleQuestion },
        { href: '/student/practice', label: 'Practice', icon: ListChecks },
        { href: '/student/assignments', label: 'Assignments', icon: ClipboardCheck },
        { href: '/student/progress', label: 'My progress', icon: TrendingUp }
      ]
    },
    {
      label: 'Library',
      items: [{ href: '/student/syllabus', label: 'Syllabus & chapters', icon: Layers, badge: 'subjects' }]
    }
  ],
  teacher: [
    {
      label: 'Teach',
      items: [
        { href: '/teacher', label: 'My classes', icon: LayoutDashboard },
        { href: '/teacher/assignments', label: 'Assignments', icon: ClipboardCheck },
        { href: '/teacher/topics', label: 'Topic planning', icon: ListChecks },
        { href: '/teacher/notes', label: 'Notes & practice', icon: BookOpen },
        { href: '/teacher/review', label: 'Review flags', icon: Scale }
      ]
    }
  ],
  school_admin: [
    {
      label: 'Manage',
      items: [
        { href: '/admin', label: 'Overview', icon: LayoutDashboard },
        { href: '/admin/approvals', label: 'Approvals & invites', icon: UserCog },
        { href: '/admin/classes', label: 'Classes & enrollments', icon: School },
        { href: '/admin/users', label: 'Users', icon: Users },
        { href: '/admin/audit', label: 'Audit log', icon: FileText }
      ]
    }
  ],
  master_admin: [
    {
      label: 'Platform',
      items: [
        { href: '/master', label: 'Overview', icon: LayoutDashboard },
        { href: '/master/schools', label: 'Schools', icon: School },
        { href: '/master/curriculum/boards', label: 'Curriculum', icon: Library, match: '/master/curriculum' },
        { href: '/master/documents', label: 'Books & documents', icon: FileText },
        { href: '/master/audit', label: 'Audit log', icon: FileText }
      ]
    }
  ]
}

/** Returns the nav item considered active for a pathname, or null. */
export function activeNavItem(pathname: string, role: Role): NavItem | null {
  const root = ROLE_ROOT[role]
  for (const group of NAV_GROUPS[role] ?? []) {
    for (const item of group.items) {
      if (item.match) {
        if (pathname === item.match || pathname.startsWith(item.match + '/')) return item
        continue
      }
      const isHome = item.href === `/${root}`
      if (pathname === item.href || (!isHome && pathname.startsWith(item.href + '/'))) return item
    }
  }
  return null
}
