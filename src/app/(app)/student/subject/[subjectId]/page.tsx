import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { getStudentContext, getSubjectChapters, getTopicOverrideMap } from '@/lib/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeTopicProgress } from '@/lib/progress'
import { Badge, Card, CardTitle, EmptyState, PageHeader, ProgressBar } from '@/components/ui'

export const metadata = { title: 'Subject' }

export default async function SubjectPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params
  const profile = await requireRole('student')
  const ctx = await getStudentContext(profile)
  const subject = ctx?.subjects.find((s) => s.id === subjectId)
  if (!ctx || !subject) notFound()

  const [chapters, overrides] = await Promise.all([
    getSubjectChapters(subjectId),
    getTopicOverrideMap(ctx.schoolClassId, subjectId)
  ])

  const admin = createAdminClient()
  const [{ data: attempts }, { data: formulas }] = await Promise.all([
    admin
      .from('practice_attempts')
      .select('topic_id, correct, created_at')
      .eq('student_id', profile.id)
      .eq('subject_id', subjectId)
      .limit(500),
    admin
      .from('formulas')
      .select('id, chapter_id, title, expression, description, topics(title)')
      .in('chapter_id', chapters.length > 0 ? chapters.map((c) => c.id) : ['00000000-0000-0000-0000-000000000000'])
  ])

  const topicIds = chapters.flatMap((c) => c.topics.map((t) => t.id))
  const myAttempts = (attempts ?? []).filter((a) => a.topic_id && topicIds.includes(a.topic_id))
  const progress = computeTopicProgress(
    myAttempts.map((a) => ({ topic_id: a.topic_id, correct: a.correct, created_at: a.created_at }))
  )
  const excludedCount = chapters.flatMap((c) => c.topics).filter((t) => overrides.get(t.id) === 'excluded').length

  return (
    <>
      <PageHeader
        title={subject.name}
        subtitle={`${ctx.boardName} · Class ${ctx.grade} · ${ctx.subjects.length} subjects enabled for you`}
      >
        <div className="flex flex-wrap gap-2">
          <Link href={`/student/tutor?subject=${subjectId}`} className="btn-primary">
            Ask the tutor
          </Link>
          <Link href={`/student/practice?subject=${subjectId}`} className="btn-secondary">
            Practice questions
          </Link>
        </div>
      </PageHeader>

      {excludedCount > 0 ? (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Your teacher has excluded {excludedCount} topic{excludedCount > 1 ? 's' : ''} from your syllabus this year —
          they are marked below.
        </p>
      ) : null}

      {chapters.length === 0 ? (
        <EmptyState title="No chapters yet" hint="The platform administrator has not added chapters for this subject." />
      ) : (
        <div className="space-y-4">
          {chapters.map((c) => {
            const chapterFormulas = (formulas ?? []).filter((f) => f.chapter_id === c.id)
            return (
              <Card key={c.id}>
                <CardTitle
                  right={
                    <Link
                      href={`/student/tutor?subject=${subjectId}&chapter=${c.id}`}
                      className="text-sm font-semibold text-indigo-600 hover:underline"
                    >
                      Ask about this chapter →
                    </Link>
                  }
                >
                  Chapter {c.number}: {c.title}
                </CardTitle>
                {c.topics.length === 0 ? (
                  <p className="text-sm text-slate-500">No topics listed for this chapter yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {c.topics.map((t) => {
                      const state = overrides.get(t.id)
                      const p = progress[t.id]?.pct ?? null
                      return (
                        <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 px-3 py-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{t.title}</span>
                          {state === 'emphasized' ? <Badge tone="amber">Teacher: emphasized</Badge> : null}
                          {state === 'excluded' ? <Badge tone="rose">Not in syllabus</Badge> : null}
                          <div className="w-40">
                            <ProgressBar pct={state === 'excluded' ? null : p} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {chapterFormulas.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Key formulas</p>
                    <ul className="space-y-1">
                      {chapterFormulas.map((f) => (
                        <li key={f.id} className="text-sm text-slate-600">
                          <span className="font-semibold text-slate-700">{f.title}:</span>{' '}
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">{f.expression}</code>
                          {(f.topics as unknown as { title: string } | null) ? (
                            <span className="ml-1 text-xs text-slate-400">({(f.topics as unknown as { title: string }).title})</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
