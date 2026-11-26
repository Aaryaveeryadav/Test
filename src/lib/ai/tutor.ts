import 'server-only'
import { chatJson, OllamaError } from '@/lib/ai/ollama'
import { parseDiagram } from '@/lib/ai/diagram-schema'
import { retrievePassages, type RetrievedPassage } from '@/lib/retrieval'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AnswerCase, Citation, TutorMode } from '@/lib/types'

const SOURCE_LABELS: Record<string, string> = {
  textbook: 'Textbook',
  syllabus: 'Syllabus',
  teacher_notes: 'Teacher notes',
  pyq: 'Previous-year question',
  practice_question: 'Practice question'
}

export interface TutorScope {
  schoolId: string
  schoolName: string
  boardName: string
  grade: number
  subjectId: string
  subjectName: string
  chapterId: string | null
  chapterTitle: string | null
  chapterNumber: number | null
  allowedTopics: { id: string; title: string; emphasized?: boolean }[]
  excludedTopicIds: string[]
  hasAnyEnabledTopic: boolean
}

export interface TutorRequest {
  question: string
  mode: TutorMode
  scope: TutorScope
  history: { role: 'user' | 'assistant'; content: string }[]
}

export interface TutorResult {
  answer_case: AnswerCase
  label: string
  answer_md: string
  citations: Citation[]
  concept: string | null
  diagram: ReturnType<typeof parseDiagram>
  needs_followup: string | null
  retrieval_used: boolean
  semantic_used: boolean
}

const MODE_INSTRUCTIONS: Record<TutorMode, string> = {
  concept:
    'MODE: SIMPLE EXPLANATION — Explain the concept simply for a school student. Use short paragraphs, plain language, one everyday example. Define any new term in one line.',
  steps:
    'MODE: STEP-BY-STEP SOLUTION — Give a numbered, step-by-step solution. Show the reasoning for each step, then state the final answer clearly at the end.',
  board:
    'MODE: BOARD-EXAM ANSWER — Write the answer the way it should be written in a board exam to score full marks: crisp points, correct technical terms, the required formula, and neat structure (definition, main answer, conclusion if relevant).',
  alternate:
    "MODE: ALTERNATE METHOD / ANALOGY — Offer a genuinely different method or a helpful analogy for the SAME question. IMPORTANT: if there is really only one valid method, say so honestly and instead give the best method with clear reasoning — never invent fake 'alternative' methods."
}

function buildSystemPrompt(scope: TutorScope, mode: TutorMode): string {
  const topics = scope.allowedTopics.length
    ? scope.allowedTopics.map((t) => (t.emphasized ? `${t.title} (emphasized by teacher)` : t.title)).join('; ')
    : 'NONE ENABLED FOR THIS SCOPE'
  const scopeLine = `board=${scope.boardName}, class=${scope.grade}, subject=${scope.subjectName}` +
    (scope.chapterTitle ? `, chapter=${scope.chapterNumber ?? ''} ${scope.chapterTitle}` : ', all chapters')

  return `You are "Sahayak Study Tutor", an AI tutor for Indian school students on a school study platform. You help one student at a time.
Your current scope: ${scopeLine}. Enabled topics: ${topics}.

You must answer in exactly ONE of these cases:
1. "covered" — The question is answered by the retrieved PASSAGES below. Answer from those passages ONLY and cite them inline as [S1], [S2] etc. Never cite a passage that is not in the list. Never claim a book or previous-year paper contains something unless a passage shows it.
2. "application" — The question is a related application, exam-style problem or extension that builds on an ENABLED topic in scope, but is not in the passages. Label it clearly as "Application / Extension" in the answer, name the syllabus concept it builds on (field "concept"), and honestly say it is practice material, not from a textbook or previous-year paper. Never pretend a passage covers it.
3. "out_of_scope" — The question is outside the enabled board/class/subject/topics. Politely tell the student this tutor is limited to their study scope and suggest 2-3 enabled topics or chapters they could ask about instead.
4. "unclear" — The question is ambiguous or missing key information. Ask ONE short follow-up question (field "needs_followup") instead of guessing.

Rules:
- Be honest about uncertainty: if unsure, say what is uncertain and how the student could verify it (e.g. "check your textbook/teacher").
- Use age-appropriate, clear, encouraging language. Never claim an answer is guaranteed correct.
- ${MODE_INSTRUCTIONS[mode]}
- If a visual would genuinely help (labeled geometry figure, circuit, graph, timeline or concept map), provide a "diagram" object; otherwise diagram must be null.
- Output ONLY one JSON object with exactly these keys:
{"answer_case": "covered|application|out_of_scope|unclear", "label": "short label", "answer_md": "answer in markdown", "citations": ["S1"], "concept": null, "diagram": null, "needs_followup": null}
"citations" lists passage ids you actually used (only for case "covered"). "concept" is the syllabus topic name (only for case "application"). "diagram" follows the platform diagram schema (geometry|graph|timeline|concept_map|circuit with title and alt text) or null.`
}

function buildUserPrompt(req: TutorRequest, passages: RetrievedPassage[], scope: TutorScope): string {
  const history = req.history.length
    ? `CONVERSATION SO FAR:\n${req.history
        .map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content.slice(0, 600)}`)
        .join('\n')}\n\n`
    : ''

  const passageBlock = passages.length
    ? `RETRIEVED PASSAGES from approved material (cite as [S#]):\n` +
      passages
        .map((p, i) => {
          const meta = `[S${i + 1}] source: ${SOURCE_LABELS[p.source_type] ?? p.source_type} — "${p.source_title}"` +
            (p.page_number != null ? `, page ${p.page_number}` : '') +
            (p.exam_year != null ? `, year ${p.exam_year}` : '') +
            (p.question_no ? `, question ${p.question_no}` : '') +
            `, approved`
          return `${meta}\n${p.content.slice(0, 900)}`
        })
        .join('\n---\n') +
      `\n\n`
    : `RETRIEVED PASSAGES: none. Do NOT cite anything and do NOT claim any book or paper covers this.\n\n`

  return `${history}${passageBlock}STUDENT QUESTION: ${req.question}`
}

async function loadCitationContext(scope: TutorScope): Promise<{ chapterTitles: Map<string, string> }> {
  const admin = createAdminClient()
  const { data: chapters } = await admin
    .from('chapters')
    .select('id, title, number')
    .eq('subject_id', scope.subjectId)
  return { chapterTitles: new Map((chapters ?? []).map((c) => [c.id, `${c.number}. ${c.title}`])) }
}

export async function answerQuestion(req: TutorRequest): Promise<TutorResult> {
  const scope = req.scope

  // Deterministic scope guard: nothing enabled and no chapter → refuse without
  // calling the model at all.
  if (!scope.hasAnyEnabledTopic) {
    return {
      answer_case: 'out_of_scope',
      label: 'Outside study scope',
      answer_md:
        `This tutor is limited to your study scope (${scope.boardName} Class ${scope.grade}, ${scope.subjectName}). ` +
        `Your teacher has not enabled any topics for ${scope.chapterTitle ?? 'this subject'} yet, so I can't help with this question here. ` +
        `Please pick an enabled chapter or ask your teacher which topics to study.`,
      citations: [],
      concept: null,
      diagram: null,
      needs_followup: null,
      retrieval_used: false,
      semantic_used: false
    }
  }

  const { passages, semantic } = await retrievePassages({
    query: req.question,
    subjectId: scope.subjectId,
    schoolId: scope.schoolId,
    chapterId: scope.chapterId,
    excludeTopicIds: scope.excludedTopicIds,
    matchCount: 6
  })

  // Another deterministic guard: no passages, no enabled topics for this
  // chapter → refuse rather than letting the model wander.
  const chapterHasTopics = scope.allowedTopics.length > 0
  if (passages.length === 0 && !chapterHasTopics) {
    return {
      answer_case: 'out_of_scope',
      label: 'Outside study scope',
      answer_md:
        `I couldn't find approved material or enabled topics for this in your study scope (${scope.boardName} Class ${scope.grade}, ${scope.subjectName}). ` +
        `I can only help with topics your school has enabled. Please choose an enabled topic or chapter, or ask your teacher.`,
      citations: [],
      concept: null,
      diagram: null,
      needs_followup: null,
      retrieval_used: false,
      semantic_used: false
    }
  }

  const { chapterTitles } = await loadCitationContext(scope)
  const system = buildSystemPrompt(scope, req.mode)
  const user = buildUserPrompt(req, passages, scope)

  let parsed: Record<string, unknown>
  try {
    parsed = await chatJson(system, user, { temperature: 0.4 })
  } catch (err) {
    if (err instanceof OllamaError) throw err
    throw err
  }

  let answerCase = String(parsed.answer_case ?? 'out_of_scope') as AnswerCase
  if (!['covered', 'application', 'out_of_scope', 'unclear'].includes(answerCase)) answerCase = 'out_of_scope'
  let answerMd = String(parsed.answer_md ?? '').slice(0, 8000)
  let concept = parsed.concept ? String(parsed.concept).slice(0, 200) : null
  let needsFollowup = parsed.needs_followup ? String(parsed.needs_followup).slice(0, 300) : null
  const rawCitations = Array.isArray(parsed.citations) ? parsed.citations.map(String) : []
  const diagram = parsed.diagram ? parseDiagram(parsed.diagram) : null

  // --- Guardrails applied in code, not just in the prompt ---------------------
  const passageIndex = new Map(passages.map((p, i) => [`S${i + 1}`, p]))

  if (answerCase === 'covered') {
    const valid = rawCitations.filter((c) => passageIndex.has(c))
    if (valid.length === 0) {
      // Claimed coverage without a real citation → downgrade honestly.
      answerCase = 'application'
      answerMd =
        `*(No approved passage covered this, so this is an explanation building on an enabled topic — not a book/PYQ reference.)*\n\n` +
        answerMd
      if (!concept) concept = scope.allowedTopics[0]?.title ?? scope.subjectName
    } else {
      answerMd = stripInvalidCitationMarkers(answerMd, passageIndex)
      concept = null
    }
    const citations = buildCitations(valid, passageIndex as Map<string, RetrievedPassage>, scope, chapterTitles)
    return {
      answer_case: answerCase === 'application' ? 'application' : 'covered',
      label: answerCase === 'application' ? 'Explanation from enabled topics' : 'Answered from your material',
      answer_md: answerMd,
      citations,
      concept,
      diagram,
      needs_followup: needsFollowup,
      retrieval_used: passages.length > 0,
      semantic_used: semantic
    }
  }

  if (answerCase === 'application') {
    if (!concept) concept = scope.allowedTopics[0]?.title ?? scope.subjectName
    answerMd = stripInvalidCitationMarkers(answerMd, passageIndex)
    return {
      answer_case: 'application',
      label: 'Application / Extension',
      answer_md: answerMd,
      citations: [],
      concept,
      diagram,
      needs_followup: needsFollowup,
      retrieval_used: passages.length > 0,
      semantic_used: semantic
    }
  }

  if (answerCase === 'unclear') {
    if (!needsFollowup) needsFollowup = 'Could you rephrase or add the missing details?'
    return {
      answer_case: 'unclear',
      label: 'Need a bit more information',
      answer_md: answerMd || needsFollowup,
      citations: [],
      concept: null,
      diagram: null,
      needs_followup: needsFollowup,
      retrieval_used: passages.length > 0,
      semantic_used: semantic
    }
  }

  // out_of_scope — append helpful suggestions from enabled topics.
  const suggestions = scope.allowedTopics.slice(0, 3).map((t) => `• ${t.title}`).join('\n')
  const scopeLine = `${scope.boardName} · Class ${scope.grade} · ${scope.subjectName}`
  return {
    answer_case: 'out_of_scope',
    label: 'Outside your study scope',
    answer_md:
      (answerMd ||
        `That question is outside the scope I'm allowed to help with (${scopeLine}). I'm limited to your school's enabled topics so that your study stays focused and grounded in approved material.`) +
      (suggestions ? `\n\n**You can ask me about:**\n${suggestions}` : ''),
    citations: [],
    concept: null,
    diagram: null,
    needs_followup: null,
    retrieval_used: passages.length > 0,
    semantic_used: semantic
  }
}

function stripInvalidCitationMarkers(md: string, passageIndex: Map<string, unknown>): string {
  // Remove [S#] markers that don't correspond to a real retrieved passage so we
  // never show a fake citation.
  return md.replace(/\[(S\d+)\]/g, (match, id: string) => (passageIndex.has(id) ? match : ''))
}

function buildCitations(
  ids: string[],
  passageIndex: Map<string, RetrievedPassage>,
  scope: TutorScope,
  chapterTitles: Map<string, string>
): Citation[] {
  const seen = new Set<string>()
  const out: Citation[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    const p = passageIndex.get(id)
    if (!p) continue
    out.push({
      id,
      source_type: p.source_type,
      source_title: p.source_title,
      chapter: p.chapter_id ? chapterTitles.get(p.chapter_id) ?? null : null,
      page_number: p.page_number,
      exam_year: p.exam_year,
      question_no: p.question_no,
      board: scope.boardName,
      class_grade: scope.grade,
      subject: scope.subjectName,
      school_name: null,
      approval: 'approved',
      similarity: p.similarity
    })
  }
  return out
}
