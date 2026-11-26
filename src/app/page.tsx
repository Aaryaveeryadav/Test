import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpenCheck, Lock, ShieldCheck, Sparkles } from 'lucide-react'
import { getProfile } from '@/lib/auth'
import { ROLE_HOME } from '@/lib/types'
import { BrandLockup } from '@/components/brand'

export default async function LandingPage() {
  const profile = await getProfile()
  if (profile) redirect(ROLE_HOME[profile.role])

  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  const features = [
    {
      icon: BookOpenCheck,
      title: 'Grounded answers',
      text: 'Answers cite approved textbooks, syllabus material, teacher notes and previous-year questions with page numbers.'
    },
    {
      icon: Sparkles,
      title: 'Every way to solve it',
      text: 'Simple explanation, step-by-step solution, board-exam answer, or an alternate method when one truly exists.'
    },
    {
      icon: Lock,
      title: 'Local AI only',
      text: 'Questions and books never leave the school setup for cloud AI. The model runs on your own hardware.'
    },
    {
      icon: ShieldCheck,
      title: 'School isolation',
      text: 'Strict role-based access. Every request is checked server-side; schools only ever see their own data.'
    }
  ]

  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <BrandLockup />
        <nav className="flex items-center gap-3 text-sm font-semibold">
          <Link href="/privacy" className="text-stone-500 hover:text-stone-800">
            Privacy
          </Link>
          <Link href="/login" className="btn-secondary">
            Sign in
          </Link>
        </nav>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16">
        {!configured ? (
          <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Setup needed:</strong> Supabase environment variables are not configured yet. Copy{' '}
            <code>.env.example</code> to <code>.env.local</code>, fill in your Supabase URL and keys, and restart the
            app. See README.md for the full setup guide.
          </div>
        ) : null}

        {/* Hero */}
        <section className="grid items-center gap-10 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:py-14">
          <div>
            <span className="badge bg-blush-100 text-rose-800 ring-1 ring-rose-200">
              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              CLASS 10–12 · NCERT · BOARD-WISE
            </span>
            <h1 className="mt-4 font-serif text-4xl font-bold leading-[1.08] tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
              One question.
              <br />
              <span className="box-decoration-clone bg-hl px-1">Every way</span> to solve it.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-stone-600">
              Ask any question from your syllabus. Sahayak shows the same answer worked out different ways — so you
              learn the reasoning, not just the result. Every answer cites your school&apos;s approved books and
              past-year questions.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn-primary px-5 py-2.5">
                Request access with school code
              </Link>
              <Link href="/login" className="btn-secondary px-5 py-2.5">
                Sign in
              </Link>
            </div>
            <p className="mt-3 text-xs text-stone-400">
              One login for everyone — your role (student, teacher, school admin, master admin) is decided by your
              account, not a form.
            </p>
          </div>

          <aside className="card rotate-1 p-6 shadow-pop">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Sample question</p>
            <p className="mt-3 font-serif text-2xl font-semibold text-stone-900">2x² + x − 6 = 0</p>
            <ol className="mt-4 space-y-2.5 text-sm text-stone-600">
              <li className="flex gap-2.5">
                <span className="font-semibold text-rose-600">1</span> Factorise: (2x − 3)(x + 2) = 0
              </li>
              <li className="flex gap-2.5">
                <span className="font-semibold text-rose-600">2</span> So x = 3/2 or x = −2
              </li>
              <li className="flex gap-2.5">
                <span className="font-semibold text-rose-600">3</span> Check by substituting back — both work ✓
              </li>
            </ol>
            <p className="mt-4 border-t border-dashed border-stone-200 pt-3 text-xs text-stone-400">
              Shown as: simple explanation · step-by-step · board-exam answer
            </p>
          </aside>
        </section>

        {/* Feature cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="card">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-blush-100 text-rose-600">
                <f.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-3 font-serif text-lg font-bold text-stone-900">{f.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">{f.text}</p>
            </div>
          ))}
        </section>

        {/* For schools */}
        <section className="card mt-10">
          <h2 className="font-serif text-lg font-bold text-stone-900">For schools</h2>
          <p className="mt-1 text-sm leading-relaxed text-stone-600">
            Schools join with a code from the platform administrator. Students request access with their school code
            and roll number; teachers are invited or approved by the school. Guardian consent is collected for student
            accounts. AI answers are tools for learning — they are never guaranteed correct, and students can flag any
            answer for teacher review.
          </p>
        </section>
      </main>

      <footer className="border-t border-stone-200/70 py-4 text-center text-xs text-stone-400">
        Sahayak Study Platform · AI answers are not guaranteed correct — always verify with your teachers.
      </footer>
    </div>
  )
}
