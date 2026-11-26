import Link from 'next/link'
import { cookies } from 'next/headers'
import { requireRole } from '@/lib/auth'
import { getStudentContext } from '@/lib/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { subjectProgress } from '@/lib/progress'
import { DailyGoal, DailyTaskCard } from '@/components/daily-goal'
import { Card, CardTitle, EmptyState, MasteryBadge, PageHeader, ProgressBar } from '@/components/ui'
import { formatDateTime, truncate } from '@/lib/utils'
import { LANG_COOKIE, resolveLang, t, type Lang } from '@/lib/i18n'

export const metadata = { title: 'Student dashboard' }

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  )
}

export default async function StudentDashboard() {
  const profile = await requireRole('student')
  const lang: Lang = resolveLang((await cookies()).get(LANG_COOKIE)?.value)
  const ctx = await getStudentContext(profile)
  if (!ctx) {
    return (
      <>
        <PageHeader title="Welcome!" />
        <EmptyState
          title="Your class and subjects are not set up yet"
          hint="Your school administrator needs to enroll you in a class. Please check back after they confirm, or contact your school office."
        />
      </>
    )
  }

  const admin = createAdminClient()
  const [{ data: attempts }, { data: chats }, { data: assignments }] = await Promise.all([
    admin
      .from('practice_attempts')
      .select('subject_id, topic_id, correct, created_at')
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(500),
    admin
      .from('chats')
      .select('id, title, subject_id, last_message_at')
      .eq('student_id', profile.id)
      .order('last_message_at', { ascending: false })
      .limit(5),
    admin
      .from('assignments')
      .select('id, title, due_at, status, subject_id, subjects(name), submissions(score, status)')
      .eq('school_class_id', ctx.schoolClassId)
      .eq('status', 'open')
      .order('due_at', { ascending: true })
      .limit(6)
  ])

  const attemptsBySubject = new Map<string, { correct: boolean; topic_id: string | null; created_at: string }[]>()
  for (const a of attempts ?? []) {
    const list = attemptsBySubject.get(a.subject_id) ?? []
    list.push(a)
    attemptsBySubject.set(a.subject_id, list)
  }

  const doneToday = (attempts ?? []).filter((a) => isToday(a.created_at)).length

  // "Continue studying" target: the attempted subject with the lowest recorded
  // accuracy; if nothing has been attempted yet, the first subject alphabetically.
  const attempted = ctx.subjects
    .map((s) => ({ subject: s, pct: subjectProgress(attemptsBySubject.get(s.id) ?? []) }))
    .filter((x) => x.pct !== null && (attemptsBySubject.get(x.subject.id) ?? []).length > 0)
  const focus =
    attempted.length > 0
      ? attempted.reduce((min, x) => ((x.pct ?? 100) < (min.pct ?? 100) ? x : min), attempted[0]).subject
      : (ctx.subjects[0] ?? null)

  return (
    <>
      <PageHeader
        title={`Hi ${profile.full_name.split(' ')[0]} 👋`}
        subtitle={`${ctx.schoolName} · ${ctx.boardName} · ${ctx.className} ${ctx.section} · ${ctx.academicYear}`}
      />

      <DailyTaskCard doneToday={doneToday} lang={lang} />

      {/* Study plan */}
      <section className="card mt-6">
        <h2 className="font-serif text-2xl font-bold text-stone-900">{t(lang, 'dash_plan_t')}</h2>
        <p className="mt-1 text-xs text-stone-400">{t(lang, 'dash_plan_note')}</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {focus ? (
            <Link href={`/student/subject/${focus.id}`} className="btn-secondary">
              {t(lang, 'dash_continue')}
              {focus.name ? ` · ${focus.name}` : ''}
            </Link>
          ) : null}
          {focus ? (
            <Link href={`/student/practice?subject=${focus.id}`} className="btn-secondary">
              {t(lang, 'dash_practise')}
            </Link>
          ) : null}
          <Link href="/student/tutor" className="btn-secondary">
            {lang === 'hi' ? 'प्रश्न पूछें' : 'Ask a question'}
          </Link>
          <Link href="/student/progress" className="btn-secondary">
            {t(lang, '/student/progress')}
          </Link>
        </div>
        <DailyGoal doneToday={doneToday} lang={lang} />
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle
            right={
              <Link href="/student/syllabus" className="text-sm font-semibold text-rose-600 hover:underline">
                {t(lang, '/student/syllabus')} →
              </Link>
            }
          >
            {t(lang, 'dash_my_subjects')}
          </CardTitle>
          {ctx.subjects.length === 0 ? (
            <EmptyState title="No subjects enabled yet" hint="Your school will add subjects to your class soon." />
          ) : (
            <ul className="space-y-3">
              {ctx.subjects.map((s) => {
                const pct = subjectProgress(attemptsBySubject.get(s.id) ?? [])
                return (
                  <li key={s.id} className="rounded-2xl border border-stone-200/80 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/student/subject/${s.id}`}
                        className="font-serif text-lg font-bold text-stone-900 hover:text-rose-600"
                      >
                        {s.name}
                      </Link>
                      <MasteryBadge pct={pct} />
                    </div>
                    <div className="mt-2">
                      <ProgressBar pct={pct} />
                    </div>
                    <div className="mt-2 flex gap-3 text-xs">
                      <Link href={`/student/tutor?subject=${s.id}`} className="font-medium text-rose-600 hover:underline">
                        Ask tutor
                      </Link>
                      <Link
                        href={`/student/practice?subject=${s.id}`}
                        className="font-medium text-rose-600 hover:underline"
                      >
                        Practice
                      </Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle
              right={
                <Link href="/student/tutor" className="text-sm font-semibold text-rose-600 hover:underline">
                  {t(lang, 'dash_ask_tutor')}
                </Link>
              }
            >
              {t(lang, 'dash_recent_q')}
            </CardTitle>
            {chats?.length ? (
              <ul className="divide-y divide-stone-100">
                {chats.map((c) => (
                  <li key={c.id} className="py-2">
                    <Link
                      href={`/student/tutor/${c.id}`}
                      className="text-sm font-medium text-stone-700 hover:text-rose-600"
                    >
                      {truncate(c.title, 60)}
                    </Link>
                    <p className="text-xs text-stone-400">{formatDateTime(c.last_message_at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-500">
                No questions yet. Try asking the tutor about a topic you are studying.
              </p>
            )}
          </Card>

          <Card>
            <CardTitle
              right={
                <Link href="/student/assignments" className="text-sm font-semibold text-rose-600 hover:underline">
                  {t(lang, '/student/assignments')} →
                </Link>
              }
            >
              {t(lang, 'dash_assignments_due')}
            </CardTitle>
            {assignments?.length ? (
              <ul className="space-y-2">
                {assignments.map((a) => {
                  const subj = (a.subjects as unknown as { name: string } | null)?.name ?? ''
                  const sub = (a.submissions as unknown as { score: number | null; status: string }[] | null)?.[0]
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link
                        href={`/student/assignments/${a.id}`}
                        className="font-medium text-stone-700 hover:text-rose-600"
                      >
                        {truncate(a.title, 46)} <span className="text-stone-400">· {subj}</span>
                      </Link>
                      <span className="shrink-0 text-xs text-stone-500">
                        {sub
                          ? sub.status === 'graded'
                            ? `Scored ${sub.score}`
                            : 'Submitted'
                          : a.due_at
                            ? formatDateTime(a.due_at)
                            : 'Open'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-stone-500">Nothing due right now. 🎉</p>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardTitle>{t(lang, 'dash_progress_calc')}</CardTitle>
        <p className="text-sm text-stone-600">
          {lang === 'hi'
            ? 'प्रगति केवल आपके दर्ज अभ्यास प्रयासों और गृहकार्य परिणामों से आती है — ट्यूटर से चैट से कभी नहीं। अभ्यास करते रहें: हर प्रयास आपकी विषय-दक्षता अपडेट करता है। आपका दैनिक लक्ष्य केवल इसी उपकरण पर रहने वाली व्यक्तिगत योजना है — यह अंक नहीं है।'
            : 'Progress comes only from your recorded practice attempts and assignment results — never from your chats with the tutor. Keep practising: each attempt updates your topic mastery. Your daily goal is a personal planning aid stored on this device only — it is not a score.'}
        </p>
      </Card>
    </>
  )
}
