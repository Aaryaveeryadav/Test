import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { embedTexts, OllamaError } from '@/lib/ai/ollama'

/**
 * Turns reviewed content into searchable chunks. Embeddings are best-effort:
 * if the local model is offline, chunks are still stored WITHOUT embeddings so
 * keyword (full-text) retrieval keeps working; they gain vectors the next time
 * an indexing run happens. There is no cloud fallback.
 */

export function chunkText(content: string, size = 1200, overlap = 150): string[] {
  const clean = content.replace(/\r/g, '').trim()
  if (!clean) return []
  const chunks: string[] = []
  let start = 0
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length)
    if (end < clean.length) {
      // Prefer cutting at a paragraph, then a sentence boundary.
      const paraCut = clean.lastIndexOf('\n\n', end)
      const sentCut = clean.lastIndexOf('. ', end)
      if (paraCut > start + size * 0.5) end = paraCut + 2
      else if (sentCut > start + size * 0.5) end = sentCut + 1
    }
    const piece = clean.slice(start, end).trim()
    if (piece) chunks.push(piece)
    if (end >= clean.length) break
    start = Math.max(end - overlap, start + 1)
  }
  return chunks
}

async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  const out: (number[] | null)[] = new Array(texts.length).fill(null)
  const BATCH = 8
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH)
    try {
      const vectors = await embedTexts(slice)
      vectors.forEach((v, j) => {
        out[i + j] = v
      })
    } catch (err) {
      if (!(err instanceof OllamaError)) console.error('embed_batch_error', err)
      // Leave nulls — keyword search still indexes this content.
    }
  }
  return out
}

/** Create/refresh the chunk for one previous-year question. */
export async function syncPyqChunk(pyq: {
  id: string
  subject_id: string
  chapter_id: string | null
  year: number
  exam: string
  question_no: string | null
  question_text: string
  answer_text: string | null
  school_id?: null
}): Promise<void> {
  const admin = createAdminClient()
  await admin.from('chunks').delete().eq('pyq_id', pyq.id)
  const content = pyq.question_text + (pyq.answer_text ? `\n\nAnswer: ${pyq.answer_text}` : '')
  if (!content.trim()) return
  const [vector] = await embedBatch([content])
  await admin.from('chunks').insert({
    school_id: pyq.school_id ?? null,
    subject_id: pyq.subject_id,
    chapter_id: pyq.chapter_id,
    source_type: 'pyq',
    source_title: `PYQ · ${pyq.exam} ${pyq.year}`,
    exam_year: pyq.year,
    question_no: pyq.question_no,
    pyq_id: pyq.id,
    content,
    embedding: vector ?? null,
    status: 'approved'
  })
}

/** Create/refresh the chunk for a published teacher note / practice question. */
export async function syncNoteChunk(note: {
  id: string
  school_id: string
  subject_id: string
  chapter_id: string | null
  topic_id: string | null
  kind: string
  title: string
  body: string
}): Promise<void> {
  const admin = createAdminClient()
  await admin.from('chunks').delete().eq('note_id', note.id)
  const content = `${note.title}\n\n${note.body}`
  if (!content.trim()) return
  const [vector] = await embedBatch([content])
  await admin.from('chunks').insert({
    school_id: note.school_id,
    subject_id: note.subject_id,
    chapter_id: note.chapter_id,
    topic_id: note.topic_id,
    source_type: note.kind === 'practice_question' ? 'practice_question' : 'teacher_notes',
    source_title: note.title,
    note_id: note.id,
    content,
    embedding: vector ?? null,
    status: 'approved'
  })
}

export async function removeNoteChunk(noteId: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from('chunks').delete().eq('note_id', noteId)
}

export async function removePyqChunk(pyqId: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from('chunks').delete().eq('pyq_id', pyqId)
}

/** Index reviewed document pages into chunks (used by the document approval flow). */
export async function indexDocumentPages(doc: {
  id: string
  school_id: string | null
  subject_id: string
  chapter_id: string | null
  kind: string
  title: string
}, pages: { page_number: number; content: string }[]): Promise<{ chunks: number }> {
  const admin = createAdminClient()
  await admin.from('chunks').delete().eq('document_id', doc.id)

  const items: { page_number: number; text: string }[] = []
  for (const page of pages) {
    for (const text of chunkText(page.content)) {
      items.push({ page_number: page.page_number, text })
    }
  }
  if (items.length === 0) return { chunks: 0 }

  const vectors = await embedBatch(items.map((i) => i.text))
  const rows = items.map((item, i) => ({
    document_id: doc.id,
    page_number: item.page_number,
    school_id: doc.school_id,
    subject_id: doc.subject_id,
    chapter_id: doc.chapter_id,
    source_type: doc.kind === 'pyq' ? 'pyq' : doc.kind === 'teacher_notes' ? 'teacher_notes' : doc.kind,
    source_title: doc.title,
    content: item.text,
    embedding: vectors[i],
    status: 'approved' as const
  }))
  await admin.from('chunks').insert(rows)
  return { chunks: rows.length }
}
