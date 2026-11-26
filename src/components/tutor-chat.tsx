'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Bot, Lightbulb, Loader2, Send } from 'lucide-react'
import { Markdown } from '@/components/markdown'
import { Diagram } from '@/components/diagram'
import { Badge, DisclaimerNote, ScopeBar } from '@/components/ui'
import { SubmitButton } from '@/components/action-form'
import { flagMessage } from '@/actions/student-actions'
import { parseDiagram } from '@/lib/ai/diagram-schema'
import { cn } from '@/lib/utils'
import { TUTOR_MODES, type ChatListItem, type ChatMessageRow, type TutorMode } from '@/lib/types'

interface ScopeInfo {
  schoolName: string
  boardName: string
  className: string
}

export function TutorChat({
  subjects,
  chaptersBySubject,
  chats,
  initialSubjectId,
  initialChapterId,
  initialChatId,
  initialMessages,
  initialText = '',
  scopeInfo
}: {
  subjects: { id: string; name: string }[]
  chaptersBySubject: Record<string, { id: string; number: number; title: string }[]>
  chats: ChatListItem[]
  initialSubjectId: string
  initialChapterId: string | null
  initialChatId: string | null
  initialMessages: ChatMessageRow[]
  initialText?: string
  scopeInfo: ScopeInfo
}) {
  const [subjectId, setSubjectId] = useState(initialSubjectId)
  const [chapterId, setChapterId] = useState<string | null>(initialChapterId)
  const [chatId, setChatId] = useState<string | null>(initialChatId)
  const [messages, setMessages] = useState<ChatMessageRow[]>(initialMessages)
  const [mode, setMode] = useState<TutorMode>('concept')
  const [input, setInput] = useState(initialText)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modelOnline, setModelOnline] = useState<boolean | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/model-health')
      .then((r) => r.json())
      .then((d) => setModelOnline(Boolean(d?.ok)))
      .catch(() => setModelOnline(false))
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, sending])

  const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? ''
  const chapters = chaptersBySubject[subjectId] ?? []
  const chapterTitle = chapters.find((c) => c.id === chapterId)?.title ?? null

  function switchSubject(id: string) {
    setSubjectId(id)
    setChapterId(null)
    setChatId(null)
    setMessages([])
    setError(null)
  }

  function openChat(chat: ChatListItem, messages: ChatMessageRow[], subject: string, chapter: string | null) {
    setChatId(chat.id)
    setSubjectId(subject)
    setChapterId(chapter)
    setMessages(messages)
    setError(null)
  }

  async function send() {
    const question = input.trim()
    if (!question || sending) return
    setSending(true)
    setError(null)
    setInput('')
    const now = new Date().toISOString()
    const tempId = `temp-${now}`
    setMessages((m) => [
      ...m,
      { id: tempId, chat_id: chatId ?? '', role: 'user', content: question, mode, answer_case: null, label: null, concept: null, citations: null, diagram: null, needs_followup: null, flag_status: 'none', created_at: now }
    ])
    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, subject_id: subjectId, chapter_id: chapterId, message: question, mode })
      })
      const json = await res.json()
      if (!res.ok) {
        setMessages((m) => m.filter((x) => x.id !== tempId))
        setInput(question)
        setError(String(json?.error ?? 'Something went wrong. Please try again.'))
        if (typeof json?.model_online === 'boolean') setModelOnline(json.model_online)
        return
      }
      setChatId(json.chat_id)
      setMessages((m) => [...m, { ...(json.assistant as ChatMessageRow), from_store: Boolean(json.from_store) }])
    } catch {
      setMessages((m) => m.filter((x) => x.id !== tempId))
      setInput(question)
      setError('Network problem. Please check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      {/* Chat history */}
      <aside className="lg:h-fit">
        <a
          href="/student/tutor"
          onClick={() => {
            setChatId(null)
            setMessages([])
          }}
          className="btn-primary w-full"
        >
          + New question
        </a>
        <div className="mt-3 space-y-1">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Recent questions</p>
          {chats.length === 0 ? <p className="px-1 text-sm text-slate-400">Nothing yet</p> : null}
          {chats.map((c) => (
            <ChatListButton key={c.id} chat={c} active={c.id === chatId} onOpen={openChat} />
          ))}
        </div>
      </aside>

      {/* Chat area */}
      <section className="flex min-h-[70vh] flex-col rounded-xl border border-slate-200 bg-white">
        {/* Scope header — students always see the study scope of this session */}
        <div className="space-y-2 border-b p-3">
          <ScopeBar
            items={[
              ['School', scopeInfo.schoolName],
              ['Board', scopeInfo.boardName],
              ['Class', scopeInfo.className],
              ['Subject', subjectName],
              ['Chapter', chapterTitle ?? 'All chapters']
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Subject"
              value={subjectId}
              onChange={(e) => switchSubject(e.target.value)}
              className="input max-w-[220px] py-1.5 text-sm"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Chapter"
              value={chapterId ?? ''}
              onChange={(e) => {
                setChapterId(e.target.value || null)
                setChatId(null)
                setMessages([])
              }}
              className="input max-w-[260px] py-1.5 text-sm"
            >
              <option value="">All chapters</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  Ch {c.number}. {c.title}
                </option>
              ))}
            </select>
            <span
              className={cn(
                'ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
                modelOnline === null ? 'bg-slate-100 text-slate-500' : modelOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', modelOnline === null ? 'bg-slate-400' : modelOnline ? 'bg-emerald-500' : 'bg-rose-500')} />
              {modelOnline === null ? 'Checking model…' : modelOnline ? 'Tutor model online (local)' : 'Tutor model offline'}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-4" role="log" aria-live="polite">
          {messages.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              <Bot className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p>Ask a question from your syllabus — answers come from your school&apos;s approved material and the local AI model.</p>
              <p className="mt-1 text-xs">The tutor only helps with your enabled board, class and subject.</p>
            </div>
          ) : null}
          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-rose-600 px-4 py-2.5 text-sm text-white sm:max-w-[75%]">
                {m.content}
              </div>
            ) : (
              <AssistantMessage key={m.id} message={m} />
            )
          )}
          {sending ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Tutor is thinking — retrieving approved material and answering with the local model…
            </div>
          ) : null}
          {error ? (
            <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              {error}
              <p className="mt-1 text-xs text-rose-500">
                This platform never falls back to a cloud AI — the tutor only uses your local model.
              </p>
            </div>
          ) : null}
        </div>

        {/* Mode selector + input */}
        <div className="border-t p-3">
          <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Learning mode">
            {TUTOR_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                title={m.hint}
                onClick={() => setMode(m.id)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  mode === m.id ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
                aria-pressed={mode === m.id}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              rows={2}
              placeholder="Ask about an enabled topic… (Enter to send)"
              className="input resize-none"
              aria-label="Your question"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || input.trim().length === 0}
              className="btn-primary shrink-0 self-end px-4"
              aria-label="Send question"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <DisclaimerNote />
        </div>
      </section>
    </div>
  )
}

function ChatListButton({
  chat,
  active,
  onOpen
}: {
  chat: ChatListItem
  active: boolean
  onOpen: (chat: ChatListItem, messages: ChatMessageRow[], subject: string, chapter: string | null) => void
}) {
  const [loading, setLoading] = useState(false)
  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true)
        try {
          const res = await fetch(`/api/tutor?chat_id=${chat.id}`)
          if (res.ok) {
            const json = await res.json()
            onOpen(chat, json.messages ?? [], json.subject_id, json.chapter_id)
          }
        } finally {
          setLoading(false)
        }
      }}
      className={cn(
        'block w-full truncate rounded-lg px-3 py-2 text-left text-sm',
        active ? 'bg-blush-50 font-semibold text-rose-700' : 'text-slate-600 hover:bg-slate-100'
      )}
    >
      {chat.title}
    </button>
  )
}

const CASE_BADGE: Record<string, { tone: string; text: string }> = {
  covered: { tone: 'green', text: 'From your approved material' },
  application: { tone: 'indigo', text: 'Application / Extension' },
  out_of_scope: { tone: 'amber', text: 'Outside study scope' },
  unclear: { tone: 'sky', text: 'Needs more information' }
}

function AssistantMessage({ message }: { message: ChatMessageRow }) {
  const diagram = message.diagram ? parseDiagram(message.diagram) : null
  const badge = CASE_BADGE[message.answer_case ?? ''] ?? null
  return (
    <div className="max-w-full rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Bot className="h-4 w-4 text-rose-600" />
        {badge ? <Badge tone={badge.tone}>{badge.text}</Badge> : <Badge tone="slate">Tutor</Badge>}
        {message.from_store ? (
          <Badge tone="green">⚡ Instant — from the answer store (GPU not needed)</Badge>
        ) : null}
        {message.mode ? <Badge tone="slate">{TUTOR_MODES.find((t) => t.id === message.mode)?.label ?? message.mode}</Badge> : null}
      </div>
      <Markdown>{message.content}</Markdown>
      {message.concept ? (
        <p className="mt-2 text-xs text-rose-700">
          <Lightbulb className="mr-1 inline h-3 w-3" />
          Builds on syllabus concept: <strong>{message.concept}</strong>
        </p>
      ) : null}
      {diagram ? <Diagram data={diagram} /> : null}
      {message.needs_followup ? (
        <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">{message.needs_followup}</p>
      ) : null}
      {message.citations && message.citations.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold text-rose-600">
            References ({message.citations.length}) — approved material with page/numbers
          </summary>
          <ul className="mt-1 space-y-1">
            {message.citations.map((c) => (
              <li key={c.id} className="text-xs text-slate-600">
                <span className="mr-1 font-bold text-rose-600">[{c.id}]</span>
                {c.source_title}
                {c.chapter ? ` · ${c.chapter}` : ''}
                {c.page_number != null ? ` · page ${c.page_number}` : ''}
                {c.exam_year != null ? ` · year ${c.exam_year}` : ''}
                {c.question_no ? ` · Q ${c.question_no}` : ''}
                {` · ${c.board} Class ${c.class_grade} ${c.subject} · approved`}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <FlagForm messageId={message.id} status={message.flag_status} />
    </div>
  )
}

function FlagForm({ messageId, status }: { messageId: string; status: string }) {
  const [state, formAction] = useActionState(flagMessage, {})
  if (status === 'flagged') {
    return <p className="mt-2 text-xs font-medium text-amber-700">⚑ Sent to your teacher for review. Thank you!</p>
  }
  if (status === 'resolved') {
    return <p className="mt-2 text-xs font-medium text-emerald-700">✓ Your teacher reviewed this answer.</p>
  }
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-rose-600">
        ⚑ Flag this answer as wrong or unclear
      </summary>
      <form action={formAction} className="mt-2 space-y-2">
        <input type="hidden" name="message_id" value={messageId} />
        <textarea
          name="flag_note"
          rows={2}
          placeholder="What was wrong or unclear? (optional)"
          className="input text-sm"
        />
        {state.error ? <p className="text-xs text-rose-600">{state.error}</p> : null}
        {state.success ? <p className="text-xs text-emerald-700">{state.success}</p> : null}
        <SubmitButton variant="secondary" className="text-xs">
          Send to teacher
        </SubmitButton>
      </form>
    </details>
  )
}
