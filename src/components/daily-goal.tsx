'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Target } from 'lucide-react'
import { t, type Lang } from '@/lib/i18n'

const GOAL_KEY = 'sahayak:daily-goal'
const OPTIONS = [5, 10, 15, 20]

function readGoal(): number | null {
  try {
    const raw = window.localStorage.getItem(GOAL_KEY)
    const n = raw ? Number(raw) : NaN
    return OPTIONS.includes(n) ? n : null
  } catch {
    return null
  }
}

/**
 * Daily practice goal — a personal planning aid only.
 * It is stored on the device, never in the database, and is not a score.
 */
export function DailyGoal({ doneToday, lang = 'en' }: { doneToday: number; lang?: Lang }) {
  const [goal, setGoal] = useState<number | null>(null)

  useEffect(() => {
    setGoal(readGoal())
  }, [])

  const setGoalValue = (n: number) => {
    setGoal(n)
    try {
      window.localStorage.setItem(GOAL_KEY, String(n))
    } catch {
      // storage unavailable — the select still works for this session
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-stone-100 pt-4">
      <label className="flex items-center gap-2 text-sm font-medium text-stone-600">
        {t(lang, 'dash_goal')}
        <select
          value={goal ?? ''}
          onChange={(e) => setGoalValue(Number(e.target.value))}
          className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-sm font-semibold text-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          aria-label={t(lang, 'dash_goal')}
        >
          <option value="" disabled>
            {lang === 'hi' ? 'चुनें…' : 'Choose…'}
          </option>
          {OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} {t(lang, 'dash_goal_questions')}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-stone-400">{t(lang, 'dash_goal_note')}</p>
    </div>
  )
}

/** "Daily task pending" strip shown above the study plan. */
export function DailyTaskCard({ doneToday, lang = 'en' }: { doneToday: number; lang?: Lang }) {
  const [goal, setGoal] = useState<number | null>(null)

  useEffect(() => {
    setGoal(readGoal())
  }, [])

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 py-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blush-100 text-rose-600">
          <Target className="h-5 w-5" />
        </span>
        <div>
          <p className="font-serif text-lg font-bold text-stone-900">
            {goal && doneToday < goal ? t(lang, 'dash_daily_pending') : t(lang, 'dash_daily_done')}
          </p>
          <p className="text-sm text-stone-500">
            {goal
              ? `${doneToday}/${goal} ${t(lang, 'dash_done_today')}`
              : `${doneToday} ${lang === 'hi' ? 'आज अभ्यास किए' : 'practised today'}`}
          </p>
        </div>
      </div>
      <Link href="/student/practice" className="btn-secondary">
        {t(lang, 'dash_start')}
      </Link>
    </div>
  )
}
