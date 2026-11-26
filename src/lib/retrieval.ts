import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { embedText } from '@/lib/ai/ollama'

export interface RetrievedPassage {
  id: string
  content: string
  page_number: number | null
  source_type: string
  source_title: string
  chapter_id: string | null
  topic_id: string | null
  exam_year: number | null
  question_no: string | null
  similarity: number | null
  rank: number // final fused rank order, 1-based
}

interface RawPassage {
  id: string
  content: string
  page_number: number | null
  source_type: string
  source_title: string
  chapter_id: string | null
  topic_id: string | null
  exam_year: number | null
  question_no: string | null
  similarity: number | null
}

/**
 * Hybrid retrieval: semantic (pgvector) + keyword (Postgres full-text), fused
 * with Reciprocal Rank Fusion. Scoped to the subject (and chapter), and only
 * master material (school_id null) plus the student's own school content.
 * Excluded topics (teacher overrides) are filtered out.
 */
export async function retrievePassages(opts: {
  query: string
  subjectId: string
  schoolId: string
  chapterId?: string | null
  excludeTopicIds?: string[]
  matchCount?: number
}): Promise<{ passages: RetrievedPassage[]; semantic: boolean }> {
  const admin = createAdminClient()
  const k = opts.matchCount ?? 6
  const exclude = opts.excludeTopicIds ?? []
  const byId = new Map<string, RawPassage>()
  let semantic = false

  // 1) Semantic search (only if embedding succeeded)
  try {
    const vector = await embedText(opts.query)
    const { data, error } = await admin.rpc('match_chunks', {
      p_query_embedding: vector,
      p_subject: opts.subjectId,
      p_school: opts.schoolId,
      p_chapter: opts.chapterId ?? null,
      p_exclude_topics: exclude,
      p_match_count: k
    })
    if (!error && Array.isArray(data)) {
      semantic = true
      for (const row of data as RawPassage[]) byId.set(row.id, row)
    } else if (error) {
      console.error('match_chunks_error', error.message)
    }
  } catch (err) {
    // Embedding unavailable (model offline) — keyword search still works.
    console.error('embed_failed', (err as Error).message)
  }

  // 2) Keyword fallback (always attempted; also covers no-embedding case)
  const { data: fts, error: ftsError } = await admin.rpc('fts_chunks', {
    p_query: opts.query,
    p_subject: opts.subjectId,
    p_school: opts.schoolId,
    p_chapter: opts.chapterId ?? null,
    p_exclude_topics: exclude,
    p_match_count: k
  })
  if (ftsError) {
    // Last-resort fallback: naive ilike search
    console.error('fts_chunks_error', ftsError.message)
    const words = opts.query.split(/\s+/).filter((w) => w.length > 3).slice(0, 4)
    if (words.length > 0) {
      const { data: ilike } = await admin
        .from('chunks')
        .select('id, content, page_number, source_type, source_title, chapter_id, topic_id, exam_year, question_no')
        .eq('subject_id', opts.subjectId)
        .eq('status', 'approved')
        .or(opts.schoolId ? `school_id.is.null,school_id.eq.${opts.schoolId}` : 'school_id.is.null')
        .or(words.map((w) => `content.ilike.%${w}%`).join(','))
        .limit(k)
      if (Array.isArray(ilike)) {
        for (const row of ilike as RawPassage[]) byId.set(row.id, { ...row, similarity: null })
      }
    }
  } else if (Array.isArray(fts)) {
    for (const row of fts as RawPassage[]) byId.set(row.id, row)
  }

  // 3) Reciprocal Rank Fusion over the two ranked lists
  const scores = new Map<string, number>()
  const addRanks = (rows: RawPassage[] | undefined) => {
    if (!rows) return
    rows.forEach((row, i) => {
      scores.set(row.id, (scores.get(row.id) ?? 0) + 1 / (60 + i + 1))
    })
  }
  const semanticRows = [...byId.values()].filter((r) => r.similarity !== null).slice(0, k)
  addRanks(semanticRows)
  addRanks(fts as RawPassage[] | undefined)

  const fused = [...byId.values()]
    .map((row) => ({ row, score: scores.get(row.id) ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)

  return {
    passages: fused.map(({ row }, i) => ({ ...row, rank: i + 1 })),
    semantic
  }
}
