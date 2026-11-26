import { requireRole } from '@/lib/auth'
import { getTeacherAssignments } from '@/lib/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { ActionForm } from '@/components/action-form'
import { Badge, Card, CardTitle, EmptyState, PageHeader } from '@/components/ui'
import { resolveFlag } from '@/actions/teacher-actions'
import { formatDateTime, truncate } from '@/lib/utils'

export const metadata = { title: 'Review flagged answers' }

export default async function ReviewPage() {
  const profile = await requireRole('teacher')
  const assignments = await getTeacherAssignments(profile)

  if (assignments.length === 0) {
    return (
      <>
        <PageHeader title="Review flagged answers" />
        <EmptyState title="No class assignments yet" />
      </>
    )
  }

  const admin = createAdminClient()
  const { data: flagged } = await admin
    .from('messages')
    .select(
      `id, content, flag_note, created_at, chat_id,
       chats!inner(student_id, school_class_id, subject_id, title, profiles(full_name, roll_number))`
    )
    .eq('flag_status', 'flagged')
    .order('created_at', { ascending: false })
    .limit(100)

  const pairs = new Set(assignments.map((a) => `${a.schoolClassId}:${a.subjectId}`))
  const mine = (flagged ?? []).filter((m) => {
    const chat = m.chats as unknown as { school_class_id: string; subject_id: string } | null
    return chat && pairs.has(`${chat.school_class_id}:${chat.subject_id}`)
  })

  return (
    <>
      <PageHeader
        title="Review flagged answers"
        subtitle="Students can flag any tutor answer as wrong or unclear. Review it, then resolve with a note for the record."
      />
      {mine.length === 0 ? (
        <EmptyState title="Nothing flagged right now 🎉" hint="When a student flags a tutor answer, it appears here." />
      ) : (
        <div className="space-y-4">
          {mine.map((m) => {
            const chat = m.chats as unknown as {
              student_id: string
              title: string
              profiles: { full_name: string; roll_number: string | null } | null
            } | null
            return (
              <Card key={m.id}>
                <CardTitle
                  right={<Badge tone="amber">Flagged {formatDateTime(m.created_at)}</Badge>}
                >
                  {chat?.profiles?.full_name ?? 'Student'} {chat?.profiles?.roll_number ? `(${chat.profiles.roll_number})` : ''}
                </CardTitle>
                <p className="text-xs text-slate-500">Chat: {truncate(chat?.title ?? '', 60)}</p>
                {m.flag_note ? (
                  <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">Student said: {m.flag_note}</p>
                ) : null}
                <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Flagged tutor answer</p>
                  <p className="whitespace-pre-line">{truncate(m.content, 1200)}</p>
                </div>
                <div className="mt-3">
                  <ActionForm action={resolveFlag} submitLabel="Mark reviewed & resolve">
                    <input type="hidden" name="message_id" value={m.id} />
                    <div>
                      <label className="label" htmlFor={`rn_${m.id}`}>
                        Your review note (kept with the answer)
                      </label>
                      <textarea id={`rn_${m.id}`} name="review_note" rows={2} maxLength={500} className="input" placeholder="e.g. Verified with textbook — answer was correct; clarified in class." />
                    </div>
                  </ActionForm>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
