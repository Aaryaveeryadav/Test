import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { getStudentContext, getSubjectChapters, getTopicOverrideMap } from '@/lib/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { ActionForm } from '@/components/action-form'
import { Badge, Card, CardTitle, EmptyState, PageHeader } from '@/components/ui'
import { saveAttempt } from '@/actions/student-actions'

export const metadata = { title: 'Practice' }

export default async function PracticePage({
  searchParams
}: {
  searchParams: Promise<{ subject?: string; chapter?: string }>
}) {
  const params = await searchParams
  const profile = await requireRole('student')
  const ctx = await getStudentContext(profile)
  if (!ctx || ctx.subjects.length === 0) {
    return (
      <>
        <PageHeader title="Practice" />
        <EmptyState title="No subjects enabled yet" />
      </>
    )
  }

  const subjectId = ctx.subjects.some((s) => s.id === params.subject) ? params.subject! : ctx.subjects[0].id
  const subject = ctx.subjects.find((s) => s.id === subjectId)!
  const chapters = await getSubjectChapters(subjectId)
  const chapterId = params.chapter && chapters.some((c) => c.id === params.chapter) ? params.chapter : null
  const chapter = chapters.find((c) => c.id === chapterId) ?? null
  const overrides = await getTopicOverrideMap(ctx.schoolClassId, subjectId)

  const admin = createAdminClient()
  const pyqQuery = admin
    .from('pyqs')
    .select('id, year, exam, question_no, question_text, marks, chapter_id, chapters(number, title)')
    .eq('subject_id', subjectId)
    .eq('status', 'active')
    .order('year', { ascending: false })
    .limit(30)
  const notesQuery = admin
    .from('school_notes')
    .select('id, title, body, topic_id, chapter_id, topics(title)')
    .eq('school_id', ctx.schoolId)
    .eq('subject_id', subjectId)
    .eq('kind', 'practice_question')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(30)

  const [{ data: pyqs }, { data: notes }] = await Promise.all([
    chapterId ? pyqQuery.eq('chapter_id', chapterId) : pyqQuery,
    chapterId ? notesQuery.eq('chapter_id', chapterId) : notesQuery
  ])

  return (
    <>
      <PageHeader title="Practice" subtitle="Previous-year questions and your teachers' practice questions">
        <div className="flex flex-wrap gap-2">
          <form className="flex flex-wrap gap-2" action="/student/practice" method="get">
            <select name="subject" defaultValue={subjectId} className="input max-w-[220px]" aria-label="Subject">
              {ctx.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select name="chapter" defaultValue={chapterId ?? ''} className="input max-w-[260px]" aria-label="Chapter">
              <option value="">All chapters</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  Ch {c.number}. {c.title}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary">
              Filter
            </button>
          </form>
          <Link href={`/student/tutor?subject=${subjectId}${chapterId ? `&chapter=${chapterId}` : ''}`} className="btn-secondary">
            Ask the tutor about this {chapterId ? 'chapter' : 'subject'}
          </Link>
        </div>
      </PageHeader>

      <p className="mb-4 text-sm text-slate-500">
        Attempt each question yourself, then record honestly whether you solved it — that&apos;s what builds your
        progress. Board questions are labeled with their year.
      </p>

      {(pyqs?.length ?? 0) === 0 && (notes?.length ?? 0) === 0 ? (
        <EmptyState
          title="No practice questions here yet"
          hint="Your teachers and the platform administrator add previous-year questions and practice sets. You can also ask the tutor for an exam-style question on any enabled topic."
        />
      ) : null}

      {notes && notes.length > 0 ? (
        <Card className="mb-4">
          <CardTitle>From your teachers</CardTitle>
          <ul className="space-y-4">
            {notes.map((n) => {
              const topic = (n.topics as unknown as { title: string } | null)?.title
              const excluded = n.topic_id ? overrides.get(n.topic_id) === 'excluded' : false
              if (excluded) return null
              return (
                <li key={n.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-800">{n.title}</span>
                    {topic ? <Badge tone="indigo">{topic}</Badge> : null}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{n.body}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/student/tutor?subject=${subjectId}${n.chapter_id ? `&chapter=${n.chapter_id}` : ''}&q=${encodeURIComponent(n.body.slice(0, 400))}`}
                      className="text-sm font-semibold text-rose-600 hover:underline"
                    >
                      Solve every way →
                    </Link>
                    <ActionForm action={saveAttempt} submitLabel="I solved it ✅" className="inline">
                      <input type="hidden" name="subject_id" value={subjectId} />
                      <input type="hidden" name="chapter_id" value={n.chapter_id ?? ''} />
                      <input type="hidden" name="topic_id" value={n.topic_id ?? ''} />
                      <input type="hidden" name="source" value="teacher_question" />
                      <input type="hidden" name="question_ref" value={n.id} />
                      <input type="hidden" name="correct" value="true" />
                    </ActionForm>
                    <ActionForm action={saveAttempt} submitLabel="Couldn't solve — needs practice" className="inline">
                      <input type="hidden" name="subject_id" value={subjectId} />
                      <input type="hidden" name="chapter_id" value={n.chapter_id ?? ''} />
                      <input type="hidden" name="topic_id" value={n.topic_id ?? ''} />
                      <input type="hidden" name="source" value="teacher_question" />
                      <input type="hidden" name="question_ref" value={n.id} />
                      <input type="hidden" name="correct" value="false" />
                    </ActionForm>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}

      {pyqs && pyqs.length > 0 ? (
        <Card>
          <CardTitle>Previous-year board questions</CardTitle>
          <ul className="space-y-4">
            {pyqs.map((q) => {
              const ch = q.chapters as unknown as { number: number; title: string } | null
              return (
                <li key={q.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Badge tone="amber">{q.year}</Badge>
                    {ch ? (
                      <span>
                        Ch {ch.number}. {ch.title}
                      </span>
                    ) : null}
                    {q.question_no ? <span>Q{q.question_no}</span> : null}
                    {q.marks ? <span>{q.marks} marks</span> : null}
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-800">{q.question_text}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/student/tutor?subject=${subjectId}${q.chapter_id ? `&chapter=${q.chapter_id}` : ''}&q=${encodeURIComponent(q.question_text.slice(0, 400))}`}
                      className="text-sm font-semibold text-rose-600 hover:underline"
                    >
                      Solve every way →
                    </Link>
                    <span className="text-xs text-slate-300" aria-hidden="true">|</span>
                    <ActionForm action={saveAttempt} submitLabel="I solved it ✅" className="inline">
                      <input type="hidden" name="subject_id" value={subjectId} />
                      <input type="hidden" name="chapter_id" value={q.chapter_id ?? ''} />
                      <input type="hidden" name="source" value="pyq" />
                      <input type="hidden" name="question_ref" value={`PYQ ${q.year} ${q.question_no ?? ''}`} />
                      <input type="hidden" name="correct" value="true" />
                    </ActionForm>
                    <ActionForm action={saveAttempt} submitLabel="Couldn't solve — needs practice" className="inline">
                      <input type="hidden" name="subject_id" value={subjectId} />
                      <input type="hidden" name="chapter_id" value={q.chapter_id ?? ''} />
                      <input type="hidden" name="source" value="pyq" />
                      <input type="hidden" name="question_ref" value={`PYQ ${q.year} ${q.question_no ?? ''}`} />
                      <input type="hidden" name="correct" value="false" />
                    </ActionForm>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}
    </>
  )
}
