import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { ollamaHealth, modelInfo } from '@/lib/ai/ollama'

export const runtime = 'nodejs'

/** Liveness of the local tutor model — shown in the study interface header. */
export async function GET() {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
  const health = await ollamaHealth()
  const info = modelInfo()
  return NextResponse.json({
    ok: health.ok,
    models: health.models,
    chat_model: info.chatModel,
    embed_model: info.embedModel,
    note: 'Local model only — no cloud AI fallback exists in this platform.'
  })
}
