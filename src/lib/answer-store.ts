import 'server-only'
import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * The answer store (Upay-style): one reusable, citation-checked answer per
 * question. Common questions are served instantly from this store — the local
 * model is only called when a question is not in it. A question whose answer
 * is already recorded must never fail just because the GPU is busy or asleep.
 */

export interface StoredApproach {
  label: string
  kind: 'derivation' | 'explanation' | 'verification' | 'analogy'
  steps: string[]
  answer: string
}

export interface StoredCitation {
  label: string
}

export interface StoredAnswer {
  id: string
  question_text: string
  summary: string
  approaches: StoredApproach[]
  citations: StoredCitation[]
  status: 'drafted' | 'verified'
  model: string | null
}

export function questionKey(subjectId: string, question: string): string {
  const normalized = question
    .toLowerCase()
    .replace(/[\u200b-\u200d\uFEFF]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
  return createHash('sha256').update(`${subjectId}::${normalized}`).digest('hex').slice(0, 32)
}

export async function findStoredAnswer(
  admin: ReturnType<typeof createAdminClient>,
  subjectId: string,
  question: string
): Promise<StoredAnswer | null> {
  const key = questionKey(subjectId, question)
  const { data } = await admin
    .from('answer_store')
    .select('id, question_text, summary, approaches, citations, status, model')
    .eq('question_key', key)
    .maybeSingle()
  if (!data) return null
  const approaches = (data.approaches ?? []) as StoredApproach[]
  if (approaches.length === 0 || !data.summary) return null
  return {
    id: data.id,
    question_text: data.question_text,
    summary: data.summary,
    approaches,
    citations: (data.citations ?? []) as StoredCitation[],
    status: data.status,
    model: data.model
  }
}

export async function saveStoredAnswer(
  admin: ReturnType<typeof createAdminClient>,
  entry: {
    subjectId: string
    chapterId?: string | null
    topicId?: string | null
    question: string
    summary: string
    approaches: StoredApproach[]
    citations: StoredCitation[]
    model: string
    status?: 'drafted' | 'verified'
  }
): Promise<void> {
  const key = questionKey(entry.subjectId, entry.question)
  await admin.from('answer_store').upsert(
    {
      question_key: key,
      subject_id: entry.subjectId,
      chapter_id: entry.chapterId ?? null,
      topic_id: entry.topicId ?? null,
      question_text: entry.question,
      summary: entry.summary,
      approaches: entry.approaches,
      citations: entry.citations,
      status: entry.status ?? 'drafted',
      model: entry.model,
      school_id: null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'question_key' }
  )
}

const KIND_TITLE: Record<StoredApproach['kind'], string> = {
  derivation: 'Method',
  explanation: 'Explanation',
  verification: 'Verification',
  analogy: 'Analogy'
}

/** Renders a stored answer as tutor-style markdown with numbered approaches. */
export function renderStoredAnswer(stored: StoredAnswer): string {
  const parts: string[] = []
  parts.push(`**${stored.summary}**`)
  stored.approaches.forEach((a, i) => {
    parts.push(`\n**Way ${i + 1} — ${a.label}** *(${KIND_TITLE[a.kind] ?? 'Method'})*\n`)
    a.steps.forEach((s, j) => parts.push(`${j + 1}. ${s}`))
    if (a.answer && a.answer !== stored.summary) parts.push(`\n**Answer:** ${a.answer}`)
  })
  if (stored.citations.length > 0) {
    parts.push('\n---')
    parts.push(
      stored.citations
        .map((c, i) => `[${i + 1}] ${c.label}`)
        .join(' · ')
    )
  }
  return parts.join('\n')
}

export function storedCitationsForDb(stored: StoredAnswer): { id: string; label: string }[] {
  return stored.citations.map((c, i) => ({ id: String(i + 1), label: c.label }))
}
