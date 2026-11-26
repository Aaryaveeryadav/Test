import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpenCheck, GraduationCap, Lock, ShieldCheck, Sparkles } from 'lucide-react'
import { getProfile } from '@/lib/auth'
import { ROLE_HOME } from '@/lib/types'

export default async function LandingPage() {
  const profile = await getProfile()
  if (profile) redirect(ROLE_HOME[profile.role])

  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <GraduationCap className="h-6 w-6 text-indigo-600" />
          Sahayak
        </span>
        <nav className="flex items-center gap-3 text-sm font-semibold">
          <Link href="/privacy" className="text-slate-500 hover:text-slate-800">
            Privacy
          </Link>
          <Link href="/login" className="btn-secondary">
            Sign in
          </Link>
        </nav>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16">
        {!configured ? (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Setup needed:</strong> Supabase environment variables are not configured yet. Copy{' '}
            <code>.env.example</code> to <code>.env.local</code>, fill in your Supabase URL and keys, and restart the
            app. See README.md for the full setup guide.
          </div>
        ) : null}

        <section className="py-10 text-center sm:py-16">
          <h1 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            A safe study companion for Class 10 &amp; 12
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600">
            Students ask questions and practise board-style problems. Teachers guide their classes. Schools manage
            their own people. Every AI answer is grounded in your school&apos;s approved material — served by a local
            AI model, never a cloud chatbot.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login" className="btn-primary px-5 py-2.5">
              Sign in
            </Link>
            <Link href="/signup" className="btn-secondary px-5 py-2.5">
              Request access with school code
            </Link>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            One login for everyone — your role (student, teacher, school admin, master admin) is decided by your
            account, not by a form.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: BookOpenCheck,
              title: 'Grounded answers',
              text: 'Answers cite approved textbooks, syllabus material, teacher notes and previous-year questions with page numbers.'
            },
            {
              icon: Sparkles,
              title: 'Four ways to learn',
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
          ].map((f) => (
            <div key={f.title} className="card">
              <f.icon className="h-5 w-5 text-indigo-600" />
              <h2 className="mt-2 font-bold text-slate-800">{f.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{f.text}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 rounded-xl bg-white p-5 text-sm text-slate-600 shadow-card">
          <h2 className="font-bold text-slate-800">For schools</h2>
          <p className="mt-1">
            Schools join with a code from the platform administrator. Students request access with their school code
            and roll number; teachers are invited or approved by the school. Guardian consent is collected for
            student accounts. AI answers are tools for learning — they are never guaranteed correct, and students can
            flag any answer for teacher review.
          </p>
        </section>
      </main>

      <footer className="border-t py-4 text-center text-xs text-slate-400">
        Sahayak Study Platform · AI answers are not guaranteed correct — always verify with your teachers.
      </footer>
    </div>
  )
}
