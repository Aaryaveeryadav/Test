/** Shared brand mark — red gradient tile with a stacked-layers glyph. */
export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span
      className={`grid ${className} shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-sm`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="currentColor">
        <path d="M12 3 2 8.5 12 14l10-5.5L12 3Zm-7 8.9v4.1c0 1.7 3.1 3.5 7 3.5s7-1.8 7-3.5v-4.1l-7 3.8-7-3.8Z" />
      </svg>
    </span>
  )
}

/** Wordmark + tagline lockup used in the sidebar and landing header. */
export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <BrandMark className={compact ? 'h-8 w-8' : 'h-9 w-9'} />
      <span className="leading-tight">
        <span className="block font-serif text-lg font-bold tracking-tight text-stone-900">Sahayak</span>
        <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-rose-700">
          Every way to solve
        </span>
      </span>
    </span>
  )
}
