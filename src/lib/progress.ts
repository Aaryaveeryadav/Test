/**
 * Progress is calculated ONLY from recorded practice attempts and assignment
 * results — never inferred from chat. Mastery is recency-weighted so older
 * results fade: weight = exp(-days / 45).
 */
export interface TopicAttempt {
  topic_id: string | null
  correct: boolean
  created_at: string
}

export interface TopicProgress {
  pct: number | null
  attempts: number
  correct: number
}

export function computeTopicProgress(attempts: TopicAttempt[]): Record<string, TopicProgress> {
  const now = Date.now()
  const map = new Map<string, { wTotal: number; wCorrect: number; attempts: number; correct: number }>()
  for (const a of attempts) {
    if (!a.topic_id) continue
    const days = Math.max(0, (now - new Date(a.created_at).getTime()) / 86_400_000)
    const w = Math.exp(-days / 45)
    const cur = map.get(a.topic_id) ?? { wTotal: 0, wCorrect: 0, attempts: 0, correct: 0 }
    cur.wTotal += w
    if (a.correct) cur.wCorrect += w
    cur.attempts += 1
    if (a.correct) cur.correct += 1
    map.set(a.topic_id, cur)
  }
  const out: Record<string, TopicProgress> = {}
  for (const [topicId, v] of map) {
    out[topicId] = {
      pct: v.wTotal > 0 ? Math.round((v.wCorrect / v.wTotal) * 100) : null,
      attempts: v.attempts,
      correct: v.correct
    }
  }
  return out
}

export function subjectProgress(attempts: TopicAttempt[]): number | null {
  if (attempts.length === 0) return null
  const correct = attempts.filter((a) => a.correct).length
  return Math.round((correct / attempts.length) * 100)
}

/** Estimate only — never a guarantee. Used to label teacher "attention areas". */
export function attentionTopics(
  topics: { id: string; title: string }[],
  progress: Record<string, TopicProgress>
): { title: string; pct: number }[] {
  return topics
    .map((t) => ({ title: t.title, pct: progress[t.id]?.pct }))
    .filter((t): t is { title: string; pct: number } => t.pct !== null && t.pct < 60)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5)
}
