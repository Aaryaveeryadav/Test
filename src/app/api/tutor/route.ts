import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getProfile } from '@/lib/auth'
import { getTutorScope } from '@/lib/data'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/ratelimit'
import { answerQuestion } from '@/lib/ai/tutor'
import { OllamaError } from '@/lib/ai/ollama'

export const runtime = 'nodejs'
export const maxDuration = 120

const bodySchema = z.object({
  chat_id: z.string().uuid().nullish(),
  subject_id: z.string().uuid(),
  chapter_id: z.string().uuid().nullish(),
  message: z.string().min(2).max(2000),
  mode: z.enum(['concept', 'steps', 'board', 'alternate'])
})

/**
 * The ONLY AI endpoint. The browser talks to this backend; only this backend
 * talks to the local model. No cloud provider is involved anywhere.
 */
export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
  }
  if (profile.role !== 'student') {
    return NextResponse.json({ error: 'Only students can use the tutor.' }, { status: 403 })
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // Rate limits protect the shared RTX 3050 model server.
  const burst = await rateLimit(`tutor:burst:${profile.id}`, Number(process.env.TUTOR_BURST_LIMIT || 5), 300)
  const daily = await rateLimit(`tutor:daily:${profile.id}`, Number(process.env.TUTOR_DAILY_LIMIT || 30), 86_400)
  if (!burst.ok) {
    return NextResponse.json(
      { error: 'You are asking questions very quickly. Please wait a few minutes and try again.', model_online: true },
      { status: 429 }
    )
  }
  if (!daily.ok) {
    return NextResponse.json(
      { error: 'You have reached your fair-use limit for today. Please try again tomorrow or ask your teacher for offline practice.', model_online: true },
      { status: 429 }
    )
  }

  const admin = createAdminClient()
  let chatId = body.chat_id ?? null
  let scopeSubject = body.subject_id
  let scopeChapter = body.chapter_id ?? null

  if (chatId) {
    const { data: chat } = await admin
      .from('chats')
      .select('id, subject_id, chapter_id, student_id')
      .eq('id', chatId)
      .eq('student_id', profile.id)
      .maybeSingle()
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found.' }, { status: 404 })
    }
    // Keep the whole chat in one scope to avoid mixing subjects mid-conversation.
    scopeSubject = chat.subject_id
    scopeChapter = chat.chapter_id
  }

  const scope = await getTutorScope(profile, scopeSubject, scopeChapter)
  if (!scope) {
    return NextResponse.json(
      { error: 'That subject or chapter is not enabled for you. Pick one of your enabled subjects from the selector.' },
      { status: 403 }
    )
  }

  if (!chatId) {
    const { data: chat, error } = await admin
      .from('chats')
      .insert({
        student_id: profile.id,
        school_id: profile.school_id!,
        subject_id: body.subject_id,
        chapter_id: body.chapter_id ?? null,
        title: body.message.slice(0, 80)
      })
      .select('id')
      .single()
    if (error || !chat) {
      return NextResponse.json({ error: 'Could not start the chat. Please try again.' }, { status: 500 })
    }
    chatId = chat.id
  }

  // Windowed history for follow-up questions.
  const { data: historyRows } = await admin
    .from('messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(8)
  const history = (historyRows ?? [])
    .reverse()
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }))

  try {
    const result = await answerQuestion({
      question: body.message,
      mode: body.mode,
      scope,
      history
    })

    const { data: userMsg } = await admin
      .from('messages')
      .insert({ chat_id: chatId, role: 'user', content: body.message })
      .select('id, created_at')
      .single()
    const { data: assistantMsg } = await admin
      .from('messages')
      .insert({
        chat_id: chatId,
        role: 'assistant',
        content: result.answer_md,
        mode: body.mode,
        answer_case: result.answer_case,
        label: result.label,
        concept: result.concept,
        citations: result.citations,
        diagram: result.diagram,
        needs_followup: result.needs_followup
      })
      .select('id, created_at')
      .single()
    await admin.from('chats').update({ last_message_at: new Date().toISOString() }).eq('id', chatId)

    return NextResponse.json({
      chat_id: chatId,
      user_message_id: userMsg?.id,
      assistant: {
        id: assistantMsg?.id,
        chat_id: chatId,
        role: 'assistant',
        content: result.answer_md,
        mode: body.mode,
        answer_case: result.answer_case,
        label: result.label,
        concept: result.concept,
        citations: result.citations,
        diagram: result.diagram,
        needs_followup: result.needs_followup,
        flag_status: 'none',
        created_at: assistantMsg?.created_at
      }
    })
  } catch (err) {
    if (err instanceof OllamaError) {
      const status = err.status === 'overloaded' ? 429 : err.status === 'timeout' ? 504 : 503
      return NextResponse.json(
        { error: err.message, model_online: err.status !== 'offline' },
        { status }
      )
    }
    console.error('tutor_error', (err as Error).message)
    return NextResponse.json(
      { error: 'The tutor could not complete this request. Please rephrase and try again.' },
      { status: 500 }
    )
  }
}

/** Load an existing chat (student's own) for the client. */
export async function GET(req: NextRequest) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'student') {
    return NextResponse.json({ error: 'Please sign in as a student.' }, { status: 401 })
  }
  const chatId = req.nextUrl.searchParams.get('chat_id')
  if (!chatId) return NextResponse.json({ error: 'Missing chat_id.' }, { status: 400 })
  const admin = createAdminClient()
  const { data: chat } = await admin
    .from('chats')
    .select('id, subject_id, chapter_id')
    .eq('id', chatId)
    .eq('student_id', profile.id)
    .maybeSingle()
  if (!chat) return NextResponse.json({ error: 'Chat not found.' }, { status: 404 })
  const { data: messages } = await admin
    .from('messages')
    .select('id, chat_id, role, content, mode, answer_case, label, concept, citations, diagram, needs_followup, flag_status, created_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(200)
  return NextResponse.json({
    subject_id: chat.subject_id,
    chapter_id: chat.chapter_id,
    messages: messages ?? []
  })
}
