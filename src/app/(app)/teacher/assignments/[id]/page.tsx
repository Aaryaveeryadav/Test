import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { getSubjectChapters } from '@/lib/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { ActionForm } from '@/components/action-form'
import { BackLink, Badge, Card, CardTitle, EmptyState, PageHeader } from '@/components/ui'
import { addQuestion, gradeSubmission } from '@/actions/teacher-actions'
import { formatDateTime } from '@/lib/utils'

export const metadata = { title: 'Assignment detail' }

export default async function AssignmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await requireRole('teacher')
  const admin = createAdminClient()

  const { data: assignment } = await admin
    .from('assignments')
    .select('id, title, description, due_at, status, subject_id, created_by, subjects(name), school_classes(section, classes(grade, label))')
    .eq('id', id)
    .maybeSingle()
  if (!assignment || assignment.created_by !== profile.id) notFound()

  const [{ data: questions }, { data: submissions }, chapters] = await Promise.all([
    admin.from('assignment_questions').select('id, kind, question_text, options, correct_option, marks, topics(title)').eq('assignment_id', id).order('position'),
    admin
      .from('submissions')
      .select('id, status, score, feedback, created_at, student_id, profiles(full_name, roll_number), submission_answers(id, question_id, answer_text, selected_option, marks_awarded)')
      .eq('assignment_id', id)
      .order('created_at', { ascending: false }),
    getSubjectChapters(assignment.subject_id)
  ])

  const topicOptions = chapters.flatMap((c) => c.topics.map((t) => ({ id: t.id, title: `Ch ${c.number} ${c.title} · ${t.title}` })))
  const questionById = new Map((questions ?? []).map((q) => [q.id, q]))
  const cls = assignment.school_classes as unknown as { section: string; classes: { grade: number } | null } | null

  return (
    <>
      <BackLink href="/teacher/assignments">All assignments</BackLink>
      <PageHeader
        title={assignment.title}
        subtitle={`${(assignment.subjects as unknown as { name: string } | null)?.name ?? ''} · Class ${cls?.classes?.grade ?? ''} ${cls?.section ?? ''} · ${
          assignment.status === 'open' ? 'Open' : 'Closed'
        }${assignment.due_at ? ` · due ${formatDateTime(assignment.due_at)}` : ''}`}
      />
      {assignment.description ? <p className="mb-4 text-sm text-slate-600">{assignment.description}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardTitle>Questions ({questions?.length ?? 0})</CardTitle>
            {questions?.length ? (
              <ul className="space-y-3">
                {questions.map((q, i) => {
                  const options = (q.options as string[] | null) ?? []
                  return (
                    <li key={q.id} className="rounded-lg border p-3">
                      <p className="text-sm font-medium text-slate-800">
                        {i + 1}. {q.question_text}{' '}
                        <Badge tone={q.kind === 'mcq' ? 'indigo' : 'sky'}>{q.kind === 'mcq' ? 'MCQ' : 'written'}</Badge>{' '}
                        <span className="text-xs text-slate-400">({q.marks} marks)</span>
                      </p>
                      {q.kind === 'mcq' ? (
                        <ul className="mt-1 space-y-0.5">
                          {options.map((opt, idx) => (
                            <li key={idx} className={idx === q.correct_option ? 'text-sm font-semibold text-emerald-700' : 'text-sm text-slate-600'}>
                              {String.fromCharCode(65 + idx)}. {opt} {idx === q.correct_option ? '✓' : ''}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {(q.topics as unknown as { title: string } | null) ? (
                        <p className="mt-1 text-xs text-slate-400">Topic: {(q.topics as unknown as { title: string }).title}</p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No questions yet — add the first one.</p>
            )}
          </Card>

          <Card>
            <CardTitle>Add question</CardTitle>
            <ActionForm action={addQuestion} submitLabel="Add question">
              <div className="space-y-3">
                <input type="hidden" name="assignment_id" value={id} />
                <div>
                  <label className="label" htmlFor="kind">
                    Type
                  </label>
                  <select id="kind" name="kind" className="input">
                    <option value="mcq">MCQ (auto-graded)</option>
                    <option value="subjective">Written (teacher-reviewed)</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="question_text">
                    Question
                  </label>
                  <textarea id="question_text" name="question_text" required rows={3} maxLength={1000} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="options">
                    Options (MCQ only — one per line)
                  </label>
                  <textarea id="options" name="options" rows={4} className="input" placeholder={'Option A\nOption B\nOption C\nOption D'} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="correct_option">
                      Correct option #
                    </label>
                    <input id="correct_option" name="correct_option" type="number" min={1} max={6} className="input" placeholder="e.g. 2" />
                  </div>
                  <div>
                    <label className="label" htmlFor="marks">
                      Marks
                    </label>
                    <input id="marks" name="marks" type="number" min={1} max={100} defaultValue={1} className="input" />
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="topic_id">
                    Topic (optional — feeds progress)
                  </label>
                  <select id="topic_id" name="topic_id" className="input">
                    <option value="">—</option>
                    {topicOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </ActionForm>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle>Submissions</CardTitle>
            {submissions?.length ? (
              <ul className="space-y-4">
                {submissions.map((s) => {
                  const student = s.profiles as unknown as { full_name: string; roll_number: string | null } | null
                  return (
                    <li key={s.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800">
                          {student?.full_name ?? '—'} <span className="text-xs text-slate-400">({student?.roll_number ?? '—'})</span>
                        </span>
                        {s.status === 'graded' ? (
                          <Badge tone="indigo">Score: {s.score}</Badge>
                        ) : (
                          <Badge tone="amber">Needs grading</Badge>
                        )}
                      </div>
                      {s.feedback ? <p className="mt-1 text-xs text-sky-700">Feedback: {s.feedback}</p> : null}
                      <ul className="mt-2 space-y-2">
                        {(s.submission_answers as unknown as {
                          id: string
                          question_id: string
                          answer_text: string | null
                          selected_option: number | null
                          marks_awarded: number | null
                        }[] | null)?.map((ans) => {
                          const q = questionById.get(ans.question_id)
                          if (!q) return null
                          const options = (q.options as string[] | null) ?? []
                          const needsGrading = q.kind === 'subjective' && ans.marks_awarded === null
                          return (
                            <li key={ans.id} className="rounded bg-slate-50 p-2 text-sm">
                              <p className="font-medium text-slate-700">{q.question_text}</p>
                              {q.kind === 'mcq' ? (
                                <p className="text-slate-600">
                                  Selected: {ans.selected_option != null ? options[ans.selected_option] ?? '?' : '—'}
                                  {ans.marks_awarded != null ? ` · ${ans.marks_awarded}/${q.marks}` : ''}
                                </p>
                              ) : (
                                <p className="whitespace-pre-line text-slate-600">{ans.answer_text || '(no answer)'}</p>
                              )}
                              {needsGrading ? (
                                <div className="mt-2">
                                  <label className="text-xs font-medium text-slate-600" htmlFor={`marks_${ans.id}`}>
                                    Award marks (0–{q.marks})
                                  </label>
                                  <div className="mt-1 flex gap-2">
                                    <input
                                      id={`marks_${ans.id}`}
                                      name={`marks_${ans.id}`}
                                      type="number"
                                      min={0}
                                      max={q.marks}
                                      className="input max-w-[100px]"
                                    />
                                  </div>
                                </div>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                      {s.status !== 'graded' ? (
                        <div className="mt-3 border-t pt-3">
                          <ActionForm action={gradeSubmission} submitLabel="Save grading">
                            <input type="hidden" name="submission_id" value={s.id} />
                            <div>
                              <label className="label" htmlFor={`fb_${s.id}`}>
                                Feedback (optional)
                              </label>
                              <textarea id={`fb_${s.id}`} name="feedback" rows={2} maxLength={1000} className="input" />
                            </div>
                          </ActionForm>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState title="No submissions yet" hint="Students' submissions will appear here as they complete the assignment." />
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
