'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Wrong email or password. Please try again.'
          : error.message
      )
      setBusy(false)
      return
    }
    // The middleware/landing page routes each role to its own home.
    router.replace(nextPath && nextPath !== '/' ? nextPath : '/')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input pr-11"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            title={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-blush-50 hover:text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-rose-600">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
