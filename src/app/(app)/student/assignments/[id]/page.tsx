import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { getStudentContext } from '@/lib/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { ActionForm } from '@/components/action-form'
import { Badge, BackLink, Card, CardTitle, PageHeader } from '@/components/ui'
import { submitAssignment } from '@/actions/student-actions'
import { formatDateTime } from '@/lib/utils'

export const metadata = { title: 'Take assignment' }

export default async function TakeAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await requireRole('student')
  const ctx = await getStudentContext(profile)
  if (!ctx) notFound()

  const admin = createAdminClient()
  const { data: assignment } = await admin
    .from('assignments')
    .select('id, title, description, due_at, status, school_class_id, subject_id, subjects(name)')
    .eq('id', id)
    .maybeSingle()
  if (!assignment || assignment.school_class_id !== ctx.schoolClassId) notFound()

  const [{ data: questions }, { data: submission }] = await Promise.all([
    admin.from('assignment_questions').select('id, kind, question_text, options, marks, topic_id, topics(title)').eq('assignment_id', id).order('position'),
    admin
      .from('submissions')
      .select('id, status, score, feedback, graded_at, submission_answers(id, question_id, selected_option, answer_text, correct, marks_awarded)')
      .eq('assignment_id', id)
      .eq('student_id', profile.id)
      .maybeSingle()
  ])

  const subjName = (assignment.subjects as unknown as { name: string } | null)?.name ?? ''

  return (
    <>
      <BackLink href="/student/assignments">All assignments</BackLink>
      <PageHeader
        title={assignment.title}
        subtitle={`${subjName}${assignment.due_at ? ` · Due ${formatDateTime(assignment.due_at)}` : ''}${assignment.status === 'closed' ? ' · CLOSED' : ''}`}
      />
      {assignment.description ? <p className="mb-4 text-sm text-slate-600">{assignment.description}</p> : null}

      {submission ? (
        <Card>
          <CardTitle right={submission.status === 'graded' ? <Badge tone="indigo">Score: {submission.score}</Badge> : <Badge tone="sky">Awaiting teacher review</Badge>}>
            Your submission
          </CardTitle>
          <ul className="space-y-3">
            {(questions ?? []).map((q) => {
              const ans = (submission.submission_answers as unknown as { question_id: string; selected_option: number | null; answer_text: string | null; correct: boolean | null; marks_awarded: number | null }[] | null)?.find((x) => x.question_id === q.id)
              const options = (q.options as string[] | null) ?? []
              return (
                <li key={q.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium text-slate-800">{q.question_text}</p>
                  {q.kind === 'mcq' ? (
                    <p className="mt-1 text-slate-600">
                      Your answer: <strong>{ans?.selected_option != null ? options[ans.selected_option] ?? '?' : '—'}</strong>{' '}
                      {ans?.correct === true ? <Badge tone="green">Correct</Badge> : ans?.correct === false ? <Badge tone="rose">Incorrect</Badge> : null}
                    </p>
                  ) : (
                    <p className="mt-1 whitespace-pre-line text-slate-600">Your answer: {ans?.answer_text || '—'}</p>
                  )}
                  {ans?.marks_awarded != null ? <p className="mt-1 text-xs text-slate-500">Marks: {ans.marks_awarded}/{q.marks}</p> : null}
                </li>
              )
            })}
          </ul>
          {submission.feedback ? (
            <p className="mt-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-800">Teacher feedback: {submission.feedback}</p>
          ) : null}
        </Card>
      ) : assignment.status === 'closed' ? (
        <Card>
          <p className="text-sm text-slate-600">This assignment is closed and cannot be submitted anymore.</p>
        </Card>
      ) : (
        <Card>
          <CardTitle>Your answers</CardTitle>
          <ActionForm action={submitAssignment} submitLabel="Submit assignment">
            <input type="hidden" name="assignment_id" value={id} />
            <ul className="space-y-4">
              {(questions ?? []).map((q, i) => {
                const options = (q.options as string[] | null) ?? []
                return (
                  <li key={q.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium text-slate-800">
                      {i + 1}. {q.question_text} <span className="text-xs text-slate-400">({q.marks} marks)</span>
                    </p>
                    {q.kind === 'mcq' ? (
                      <fieldset className="mt-2 space-y-1.5">
                        <legend className="sr-only">Options</legend>
                        {options.map((opt, idx) => (
                          <label key={idx} className="flex items-center gap-2 text-sm">
                            <input type="radio" name={`question_${q.id}`} value={idx} />
                            {opt}
                          </label>
                        ))}
                      </fieldset>
                    ) : (
                      <textarea name={`question_${q.id}`} rows={4} className="input mt-2" placeholder="Write your answer…" />
                    )}
                  </li>
                )
              })}
            </ul>
            {(questions ?? []).length === 0 ? <p className="text-sm text-slate-500">No questions added yet.</p> : null}
          </ActionForm>
        </Card>
      )}
    </>
  )
}
