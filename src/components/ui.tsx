import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn, masteryLabel } from '@/lib/utils'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('card', className)}>{children}</div>
}

export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-bold text-slate-800">{children}</h2>
      {right}
    </div>
  )
}

const TONES: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-800',
  rose: 'bg-rose-100 text-rose-700',
  sky: 'bg-sky-100 text-sky-700'
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: keyof typeof TONES | string }) {
  return <span className={cn('badge', TONES[tone] ?? TONES.slate)}>{children}</span>
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  )
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <p className="font-medium text-slate-600">{title}</p>
      {hint ? <p className="mt-1 text-sm text-slate-500">{hint}</p> : null}
    </div>
  )
}

export function ProgressBar({ pct }: { pct: number | null }) {
  const v = pct ?? 0
  const tone = v >= 80 ? 'bg-emerald-500' : v >= 50 ? 'bg-indigo-500' : v >= 25 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full min-w-[60px] overflow-hidden rounded-full bg-slate-200">
        <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${Math.min(v, 100)}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-semibold text-slate-600">{pct === null ? '—' : `${pct}%`}</span>
    </div>
  )
}

export function MasteryBadge({ pct }: { pct: number | null }) {
  const tone = pct === null ? 'slate' : pct >= 80 ? 'green' : pct >= 50 ? 'indigo' : pct >= 25 ? 'amber' : 'rose'
  return <Badge tone={tone}>{masteryLabel(pct)}</Badge>
}

/** Shows the exact study scope of the current session (school → chapter). */
export function ScopeBar({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs">
      <span className="mr-1 font-semibold text-slate-500">Studying:</span>
      {items.map(([label, value]) => (
        <span key={label} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 shadow-sm">
          <span className="text-slate-400">{label}:</span>
          <span className="font-semibold text-slate-700">{value}</span>
        </span>
      ))}
    </div>
  )
}

export function DisclaimerNote({ children }: { children?: ReactNode }) {
  return (
    <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {children ??
        'AI answers can be wrong or incomplete. Always cross-check important facts with your textbook and teachers — answers are not guaranteed to be correct.'}
    </p>
  )
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-sm font-medium text-indigo-600 hover:underline">
      ← {children}
    </Link>
  )
}

export function Th({ children }: { children: ReactNode }) {
  return <th className="th">{children}</th>
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('td', className)}>{children}</td>
}
