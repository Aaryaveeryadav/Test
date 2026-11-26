'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { LANG_COOKIE, type Lang } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** EN / हिंदी switch — stores the choice in a cookie and refreshes the RSC tree. */
export function LangToggle({ lang, className }: { lang: Lang; className?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const set = (next: Lang) => {
    if (next === lang) return
    document.cookie = `${LANG_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`
    startTransition(() => router.refresh())
  }

  return (
    <span
      className={cn('inline-flex overflow-hidden rounded-full border border-stone-200 bg-white text-xs font-bold shadow-card', pending && 'opacity-60', className)}
      role="group"
      aria-label="Language / भाषा"
    >
      <button
        type="button"
        onClick={() => set('en')}
        aria-pressed={lang === 'en'}
        className={cn('px-2.5 py-1', lang === 'en' ? 'bg-rose-600 text-white' : 'text-stone-500 hover:text-stone-800')}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => set('hi')}
        aria-pressed={lang === 'hi'}
        className={cn('px-2.5 py-1', lang === 'hi' ? 'bg-rose-600 text-white' : 'text-stone-500 hover:text-stone-800')}
      >
        हिं
      </button>
    </span>
  )
}
