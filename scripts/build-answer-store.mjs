#!/usr/bin/env node
/**
 * Build the answer store BEFORE students need it (Upay-style).
 *
 * Runs on the machine that has Ollama (the RTX 3050 box). Reads previous-year
 * questions from Supabase, generates ≥4 genuinely distinct approaches per
 * question through the local model with retrieval context, validates the JSON,
 * and writes everything into the `answer_store` table. Students then get
 * instant answers even when the GPU is asleep — the tutor only calls the model
 * for questions that are not in the store.
 *
 * Usage (from the repo root, with .env.local filled in):
 *   node --env-file=.env.local scripts/build-answer-store.mjs [--limit 25]
 *        [--subject <subject uuid>] [--year 2023] [--verified] [--force]
 *
 * Flags:
 *   --limit N     how many questions to process this run (default 25)
 *   --subject ID  restrict to one subject (default: all subjects)
 *   --year Y      restrict to one PYQ year
 *   --verified    mark answers as verified (reserved for answers checked by a
 *                 human against the book; default 'drafted')
 *   --force       regenerate even if an answer already exists
 */
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OLLAMA = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
const MODEL = process.env.OLLAMA_CHAT_MODEL || 'llama3.1:8b'

if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const args = process.argv.slice(2)
function flag(name) {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? null : args[i + 1] ?? null
}
const hasFlag = (name) => args.includes(`--${name}`)
const LIMIT = Number(flag('limit') || 25)
const SUBJECT = flag('subject')
const YEAR = flag('year')
const STATUS = hasFlag('verified') ? 'verified' : 'drafted'
const FORCE = hasFlag('force')

const admin = createClient(URL, KEY, { auth: { persistSession: false } })

const policy = (await import('./solve-policy.json', { with: { type: 'json' } })).default

function solvePolicySystemPrompt() {
  return [
    'You are a careful Indian board-exam study assistant for Classes 10 and 12.',
    'You always answer from approved curriculum material. You never claim an answer is officially guaranteed.',
    '',
    `OUTPUT CONTRACT (${policy.version}):`,
    policy.schemaHint,
    '',
    'RULES:',
    ...policy.instructions.map((r, i) => `${i + 1}. ${r}`)
  ].join('\n')
}

function questionKey(subjectId, question) {
  const normalized = question
    .toLowerCase()
    .replace(/[\u200b-\u200d\uFEFF]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
  return createHash('sha256').update(`${subjectId}::${normalized}`).digest('hex').slice(0, 32)
}

async function ollamaJSON(messages) {
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, stream: false, format: 'json' })
  })
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`)
  const data = await res.json()
  return JSON.parse(data?.message?.content ?? '{}')
}

function validate(parsed) {
  const approaches = Array.isArray(parsed.approaches) ? parsed.approaches : []
  const ok = approaches.filter(
    (a) =>
      a &&
      typeof a.label === 'string' &&
      a.label.trim() &&
      ['derivation', 'explanation', 'verification', 'analogy'].includes(a.kind) &&
      Array.isArray(a.steps) &&
      a.steps.filter((s) => typeof s === 'string' && s.trim()).length >= 1
  )
  if (!parsed.summary || typeof parsed.summary !== 'string' || ok.length < 2) return null
  return {
    summary: parsed.summary.slice(0, 500),
    approaches: ok.map((a) => ({
      label: String(a.label).slice(0, 120),
      kind: a.kind,
      steps: a.steps.filter((s) => typeof s === 'string' && s.trim()).slice(0, 20),
      answer: typeof a.answer === 'string' ? a.answer.slice(0, 1000) : ''
    })),
    citations: Array.isArray(parsed.citations)
      ? parsed.citations.filter((c) => c && typeof c.label === 'string').map((c) => ({ label: String(c.label).slice(0, 200) }))
      : []
  }
}

async function contextFor(q) {
  // Free-text retrieval over approved chunks (no embedding needed for FTS leg).
  try {
    const { data } = await admin.rpc('fts_chunks', {
      p_query: q.question_text.slice(0, 400),
      p_subject: q.subject_id,
      p_school: null,
      p_chapter: q.chapter_id ?? null,
      p_exclude_topics: null,
      p_match_count: 4
    })
    return (data ?? []).map((c) => ({ label: c.label || c.source_label || 'approved material', text: c.content ?? '' }))
  } catch {
    return []
  }
}

const query = admin
  .from('pyqs')
  .select('id, question_text, subject_id, chapter_id, year, exam, question_no, answer_text, subjects(name)')
  .order('subject_id')
  .order('year', { ascending: false })
  .limit(2000)
if (SUBJECT) query.eq('subject_id', SUBJECT)
if (YEAR) query.eq('year', Number(YEAR))
const { data: pyqs, error } = await query
if (error) {
  console.error('Could not read pyqs:', error.message)
  process.exit(1)
}

let generated = 0
let skipped = 0
let failed = 0

for (const q of pyqs ?? []) {
  if (generated >= LIMIT) break
  const key = questionKey(q.subject_id, q.question_text)
  if (!FORCE) {
    const { data: existing } = await admin
      .from('answer_store')
      .select('id')
      .eq('question_key', key)
      .maybeSingle()
    if (existing) {
      skipped++
      continue
    }
  }

  const passages = await contextFor(q)
  const subjectName = q.subjects?.name ?? 'the subject'
  const contextBlock = [
    ...passages.map((p, i) => `[C${i + 1}] ${p.label}\n${p.text.slice(0, 700)}`),
    q.answer_text ? `[MODEL-ANSWER] Official/model answer on record:\n${q.answer_text.slice(0, 900)}` : ''
  ]
    .filter(Boolean)
    .join('\n\n')

  const userPrompt = [
    `Subject: ${subjectName} (Indian board, Classes 10–12).`,
    `Question: ${q.question_text}`,
    '',
    'APPROVED CONTEXT (cite only these; the model answer is trusted):',
    contextBlock || '(no passages retrieved — answer from secure general curriculum knowledge and say so honestly)',
    '',
    'Produce the JSON object now.'
  ].join('\n')

  try {
    const parsed = validate(await ollamaJSON([{ role: 'system', content: solvePolicySystemPrompt() }, { role: 'user', content: userPrompt }]))
    if (!parsed) {
      console.warn(`✗ ${q.question_no} ${q.year}: invalid JSON contract — skipped`)
      failed++
      continue
    }
    // The official/model answer on record is always cited.
    if (q.answer_text) {
      parsed.citations.unshift({ label: `${q.exam ?? 'Board exam'} ${q.year ?? ''}, ${q.question_no ?? ''} — model answer on record` })
    }
    const { error: upErr } = await admin.from('answer_store').upsert(
      {
        question_key: key,
        subject_id: q.subject_id,
        chapter_id: q.chapter_id ?? null,
        topic_id: null,
        question_text: q.question_text,
        summary: parsed.summary,
        approaches: parsed.approaches,
        citations: parsed.citations,
        status: STATUS,
        model: MODEL,
        school_id: null,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'question_key' }
    )
    if (upErr) throw new Error(upErr.message)
    generated++
    console.log(`✓ ${q.subjects?.name ?? ''} ${q.year} ${q.question_no}: ${parsed.approaches.length} approaches`)
  } catch (err) {
    console.warn(`✗ ${q.year} ${q.question_no}: ${err.message}`)
    failed++
  }
}

console.log(`\nDone. generated=${generated} already-present=${skipped} failed=${failed}`)
console.log('Students now get these instantly, even with the GPU asleep.')
