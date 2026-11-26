import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { getStudentContext, getSubjectChapters } from '@/lib/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { TutorChat } from '@/components/tutor-chat'
import { EmptyState, PageHeader } from '@/components/ui'
import type { ChatListItem, ChatMessageRow } from '@/lib/types'

export const metadata = { title: 'Ask the tutor' }

export default async function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params
  const profile = await requireRole('student')
  const ctx = await getStudentContext(profile)
  if (!ctx || ctx.subjects.length === 0) notFound()

  const admin = createAdminClient()
  const { data: chat } = await admin
    .from('chats')
    .select('id, title, subject_id, chapter_id')
    .eq('id', chatId)
    .eq('student_id', profile.id)
    .maybeSingle()
  if (!chat || !ctx.subjects.some((s) => s.id === chat.subject_id)) notFound()

  const [{ data: messages }, { data: chats }, chapterLists] = await Promise.all([
    admin
      .from('messages')
      .select('id, chat_id, role, content, mode, answer_case, label, concept, citations, diagram, needs_followup, flag_status, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(200),
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

  return (
    <PageHeader title="Ask the tutor">
      <TutorChat
        subjects={ctx.subjects.map((s) => ({ id: s.id, name: s.name }))}
        chaptersBySubject={chaptersBySubject}
        chats={(chats ?? []) as ChatListItem[]}
        initialSubjectId={chat.subject_id}
        initialChapterId={chat.chapter_id}
        initialChatId={chat.id}
        initialMessages={(messages ?? []) as ChatMessageRow[]}
        scopeInfo={{ schoolName: ctx.schoolName, boardName: ctx.boardName, className: `${ctx.className} ${ctx.section}` }}
      />
    </PageHeader>
  )
}
