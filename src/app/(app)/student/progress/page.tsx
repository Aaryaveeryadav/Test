import { requireRole } from '@/lib/auth'
import { getStudentContext, getSubjectChapters, getTopicOverrideMap } from '@/lib/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeTopicProgress } from '@/lib/progress'
import { Card, CardTitle, EmptyState, MasteryBadge, PageHeader, ProgressBar } from '@/components/ui'
import { DisclaimerNote } from '@/components/ui'

export const metadata = { title: 'My progress' }

export default async function ProgressPage() {
  const profile = await requireRole('student')
  const ctx = await getStudentContext(profile)
  if (!ctx) {
    return (
      <>
        <PageHeader title="My progress" />
        <EmptyState title="No class set up yet" />
      </>
    )
  }

  const admin = createAdminClient()
  const { data: attempts } = await admin
    .from('practice_attempts')
    .select('subject_id, topic_id, correct, created_at')
    .eq('student_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(1000)

  const bySubject = new Map<string, { topic_id: string | null; correct: boolean; created_at: string }[]>()
  for (const a of attempts ?? []) bySubject.set(a.subject_id, [...(bySubject.get(a.subject_id) ?? []), a])

  const subjectBlocks = await Promise.all(
    ctx.subjects.map(async (s) => {
      const [chapters, overrides] = await Promise.all([
        getSubjectChapters(s.id),
        getTopicOverrideMap(ctx.schoolClassId, s.id)
      ])
      const progress = computeTopicProgress(bySubject.get(s.id) ?? [])
      return { subject: s, chapters, overrides, progress }
    })
  )

  const totalAttempts = (attempts ?? []).length
  const totalCorrect = (attempts ?? []).filter((a) => a.correct).length

  return (
    <>
      <PageHeader
        title="My progress"
        subtitle={`Based on ${totalAttempts} recorded attempt${totalAttempts === 1 ? '' : 's'} (${totalCorrect} correct) — practice and assignments only, never from chats`}
      />

      {totalAttempts === 0 ? (
        <EmptyState
          title="No attempts recorded yet"
          hint="Go to Practice and attempt some questions, or complete an assignment. Your topic mastery will appear here."
        />
      ) : null}

      {subjectBlocks.map(({ subject, chapters, overrides, progress }) => (
        <Card key={subject.id} className="mb-4">
          <CardTitle>{subject.name}</CardTitle>
          <div className="space-y-3">
            {chapters.map((c) => (
              <div key={c.id}>
                <p className="mb-1 text-sm font-semibold text-slate-700">
                  Ch {c.number}. {c.title}
                </p>
                <ul className="space-y-1.5">
                  {c.topics.map((t) => {
                    const state = overrides.get(t.id)
                    const p = progress[t.id]?.pct ?? null
                    const attemptsN = progress[t.id]?.attempts ?? 0
                    return (
                      <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-slate-600">{t.title}</span>
                        {state === 'excluded' ? <span className="text-xs text-rose-500">not in syllabus</span> : null}
                        <span className="text-xs text-slate-400">
                          {attemptsN} attempt{attemptsN === 1 ? '' : 's'}
                        </span>
                        <div className="w-32">
                          <ProgressBar pct={state === 'excluded' ? null : p} />
                        </div>
                        <MasteryBadge pct={state === 'excluded' ? null : p} />
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
            {chapters.length === 0 ? <p className="text-sm text-slate-500">No chapters yet.</p> : null}
          </div>
        </Card>
      ))}

      <DisclaimerNote>
        Topic mastery is an estimate from your recorded attempts (recent results count more). It is a study guide, not
        a prediction of your exam score.
      </DisclaimerNote>
    </>
  )
}
