import { requireRole } from '@/lib/auth'
import { getStudentContext, getSubjectChapters } from '@/lib/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { TutorChat } from '@/components/tutor-chat'
import { EmptyState, PageHeader } from '@/components/ui'
import type { ChatListItem } from '@/lib/types'

export const metadata = { title: 'Ask the tutor' }

export default async function TutorPage({
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
        <PageHeader title="Ask the tutor" />
        <EmptyState
          title="No subjects enabled yet"
          hint="Once your school adds subjects to your class, you can ask questions here."
        />
      </>
    )
  }

  const admin = createAdminClient()
  const [{ data: chats }, chapterLists] = await Promise.all([
    admin
      .from('chats')
      .select('id, title, subject_id, chapter_id, last_message_at')
      .eq('student_id', profile.id)
      .order('last_message_at', { ascending: false })
      .limit(20),
    Promise.all(ctx.subjects.map(async (s) => [s.id, await getSubjectChapters(s.id)] as const))
  ])

  const chaptersBySubject: Record<string, { id: string; number: number; title: string }[]> = {}
  for (const [sid, chapters] of chapterLists) {
    chaptersBySubject[sid] = chapters.map((c) => ({ id: c.id, number: c.number, title: c.title }))
  }

  const validSubject = ctx.subjects.some((s) => s.id === params.subject)
  const initialSubjectId = validSubject && params.subject ? params.subject : ctx.subjects[0].id
  const initialChapterId =
    params.chapter && chaptersBySubject[initialSubjectId]?.some((c) => c.id === params.chapter) ? params.chapter : null

  return (
    <PageHeader title="Ask the tutor">
      <p className="mt-1 text-sm text-slate-500">
        Answers come from your school&apos;s approved material and the local AI model — with references when available.
      </p>
      <div className="mt-4">
        <TutorChat
          subjects={ctx.subjects.map((s) => ({ id: s.id, name: s.name }))}
          chaptersBySubject={chaptersBySubject}
          chats={(chats ?? []) as ChatListItem[]}
          initialSubjectId={initialSubjectId}
          initialChapterId={initialChapterId}
          initialChatId={null}
          initialMessages={[]}
          scopeInfo={{ schoolName: ctx.schoolName, boardName: ctx.boardName, className: `${ctx.className} ${ctx.section}` }}
        />
      </div>
    </PageHeader>
  )
}
