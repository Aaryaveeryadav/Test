import 'server-only'

/**
 * Ollama adapter — the ONLY AI backend for this platform.
 * No hosted/cloud model is called anywhere in this codebase, and there is no
 * automatic cloud fallback by design. Swap the adapter (not the callers) to
 * change the model provider.
 */

const BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || 'llama3.1:8b'
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text'
const MAX_CONCURRENT = Number(process.env.AI_MAX_CONCURRENT || 2)

export type OllamaStatus = 'offline' | 'overloaded' | 'timeout' | 'error'

export class OllamaError extends Error {
  status: OllamaStatus
  constructor(message: string, status: OllamaStatus) {
    super(message)
    this.name = 'OllamaError'
    this.status = status
  }
}

function classify(err: unknown): OllamaError {
  const e = err as { code?: string; cause?: { code?: string }; name?: string; message?: string }
  const code = e?.code ?? e?.cause?.code
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EHOSTUNREACH') {
    return new OllamaError('The local tutor model is offline. No cloud fallback is used — please try again once the model server is running.', 'offline')
  }
  if (e?.name === 'TimeoutError' || code === 'ETIMEDOUT') {
    return new OllamaError('The local tutor model took too long to respond. Please try a shorter question.', 'timeout')
  }
  return new OllamaError(e?.message || 'The local tutor model returned an error.', 'error')
}

// --- Tiny concurrency limiter: protects a single RTX 3050 from overload ------
let active = 0
const waiters: Array<() => void> = []

async function acquireSlot(timeoutMs = 8000): Promise<boolean> {
  if (active < MAX_CONCURRENT) {
    active++
    return true
  }
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      const i = waiters.indexOf(fn)
      if (i >= 0) waiters.splice(i, 1)
      resolve(false)
    }, timeoutMs)
    const fn = () => {
      clearTimeout(timer)
      active++
      resolve(true)
    }
    waiters.push(fn)
  })
}

function releaseSlot() {
  active--
  const next = waiters.shift()
  if (next) next()
}

// --- Health ------------------------------------------------------------------

export async function ollamaHealth(timeoutMs = 2500): Promise<{ ok: boolean; models: string[] }> {
  try {
    const res = await fetch(`${BASE_URL}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return { ok: false, models: [] }
    const json = (await res.json()) as { models?: { name?: string }[] }
    return { ok: true, models: (json.models ?? []).map((m) => m?.name ?? '').filter(Boolean) }
  } catch {
    return { ok: false, models: [] }
  }
}

// --- Embeddings --------------------------------------------------------------

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  if (!(await acquireSlot())) {
    throw new OllamaError('The tutor is busy right now — please try again in a few seconds.', 'overloaded')
  }
  try {
    const res = await fetch(`${BASE_URL}/api/embed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
      signal: AbortSignal.timeout(60_000)
    })
    if (!res.ok) throw new OllamaError(`Embedding failed (HTTP ${res.status}).`, 'error')
    const json = (await res.json()) as { embeddings?: number[][] }
    const embeddings = json.embeddings
    if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
      throw new OllamaError('Embedding model returned an unexpected response.', 'error')
    }
    return embeddings
  } catch (err) {
    if (err instanceof OllamaError) throw err
    throw classify(err)
  } finally {
    releaseSlot()
  }
}

export async function embedText(text: string): Promise<number[]> {
  return (await embedTexts([text]))[0]
}

// --- Chat (JSON mode) --------------------------------------------------------

function extractJsonObject(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
      } catch {
        /* fall through */
      }
    }
    throw new OllamaError('The tutor model returned an unreadable response. Please rephrase and try again.', 'error')
  }
}

export async function chatJson(
  system: string,
  user: string,
  opts?: { temperature?: number; timeoutMs?: number }
): Promise<Record<string, unknown>> {
  if (!(await acquireSlot())) {
    throw new OllamaError('The tutor is busy right now — please try again in a few seconds.', 'overloaded')
  }
  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        stream: false,
        format: 'json',
        options: { temperature: opts?.temperature ?? 0.4, num_ctx: 8192 }
      }),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 120_000)
    })
    if (!res.ok) {
      throw new OllamaError(`Tutor model error (HTTP ${res.status}).`, res.status === 429 ? 'overloaded' : 'error')
    }
    const json = (await res.json()) as { message?: { content?: string } }
    const content = json?.message?.content ?? ''
    return extractJsonObject(content)
  } catch (err) {
    if (err instanceof OllamaError) throw err
    throw classify(err)
  } finally {
    releaseSlot()
  }
}

export const modelInfo = () => ({ baseUrl: BASE_URL, chatModel: CHAT_MODEL, embedModel: EMBED_MODEL })
