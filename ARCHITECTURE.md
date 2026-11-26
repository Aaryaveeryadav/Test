# Architecture Guide

## System overview

```
Browser (React/Next.js client components)
   │  publishable key only, RLS-scoped reads
   ▼
Next.js backend (Node runtime)  ──  the ONLY caller of the model server
   │  service-role key, explicit authz per request, audit logs
   ├──► Supabase Postgres + pgvector  (data, search, RLS defense-in-depth)
   ├──► Supabase Auth                 (sessions, password hashing)
   ├──► Supabase Storage              (private PDF bucket, service-role only)
   └──► Ollama (RTX 3050 machine)     (chat + embeddings, local only, no cloud fallback)
```

Key rule: **the browser never talks to the model server.** Only `src/lib/ai/ollama.ts` does, and it
is imported exclusively by server code (`import 'server-only'`). There is no hosted-AI codepath
anywhere in the repository, and no automatic fallback — if Ollama is down, users get a clear error.

## Module map

| Path | Responsibility |
| --- | --- |
| `src/middleware.ts` | Session validation, role/school gating, suspension enforcement |
| `src/lib/auth.ts` | `getProfile/requireProfile/requireRole` — role always from server record |
| `src/lib/supabase/{server,admin,client,middleware}` | Supabase clients: user-cookie, service-role (server-only), browser |
| `src/lib/data.ts` | Scoped context loaders (student/teacher/tutor scope) |
| `src/lib/ai/ollama.ts` | **Replaceable model adapter**: health, chat (JSON mode), embeddings, concurrency limiter, error classification (offline/overloaded/timeout) |
| `src/lib/ai/tutor.ts` | RAG pipeline: scope validation → hybrid retrieval → prompt → JSON parse → **code-level guardrails** (citation verification, case downgrades) |
| `src/lib/retrieval.ts` | Hybrid search: `match_chunks` (pgvector) + `fts_chunks` (Postgres FTS), Reciprocal Rank Fusion |
| `src/lib/ai/diagram-schema.ts` | Zod schema + parser for diagram data; renderer in `src/components/diagram.tsx` |
| `src/lib/rag-sync.ts` | Chunking, best-effort embedding, PYQ/notes/document indexing |
| `src/lib/progress.ts` | Recency-weighted mastery from **recorded attempts only** |
| `src/lib/ratelimit.ts` | Atomic Postgres sliding-window limiter |
| `src/lib/audit.ts` | Audit log writer (no PII/chat content in details) |
| `src/actions/*.ts` | Server actions: `auth-actions`, `student-actions`, `teacher-actions`, `admin-actions`, `master-actions` — each re-checks role/school |
| `src/app/(app)/**` | Role-scoped pages (student/teacher/admin/master) |
| `src/app/api/tutor/route.ts` | The single AI endpoint (POST ask, GET chat history) |
| `supabase/migrations/**` | Schema, RLS, search functions, storage bucket |
| `scripts/*.mjs` | Master-admin provisioning, demo seeding, retention cleanup |

## Data flow: grounded answer

1. Student selects subject/chapter (scope bar shows school → board → class → subject → chapter).
2. `POST /api/tutor` → profile check (student only) → rate limits → `getTutorScope` verifies the
   subject belongs to the student's class and builds the enabled-topic list (teacher exclusions
   removed). Deterministic refusals happen here if nothing is enabled.
3. `retrievePassages`: embed the question (Ollama) → `match_chunks` (cosine, scoped to
   `subject_id`, `school_id IS NULL OR = student's school`, excluded topics filtered) +
   `fts_chunks` keyword fallback → Reciprocal Rank Fusion → top 6 passages with metadata.
4. Prompt instructs the three answer cases; model answers in JSON mode.
5. **Code guardrails**: citations not in the retrieved set are stripped; `covered` with zero valid
   citations is downgraded to `application` with an honest note; `application` must name the
   syllabus concept; `out_of_scope` gets suggestions from enabled topics.
6. Messages persist (user + assistant rows with citations/diagram JSON); UI renders markdown
   (sanitized components), citation list, and the diagram from validated data.

## Answer-case rules (enforced twice)

| Case | Prompt rule | Code enforcement |
| --- | --- | --- |
| `covered` | Only from passages; cite `[S#]` | Strip invalid `[S#]`; downgrade if no valid citations |
| `application` | Builds on enabled topic; labeled; never claims a book/PYQ | Concept required; citation markers stripped |
| `out_of_scope` | Polite refusal + suggestions | Suggestions appended from enabled topics |
| `unclear` | One short follow-up | Default follow-up if missing |

## School isolation

- Every school-scoped table carries a denormalized `school_id` so RLS policies are join-free.
- The tutor and dashboards always derive scope from the caller's profile (never from URL params
  alone; URL IDs are re-verified server-side).
- Master curriculum (`boards…pyqs`, `chunks` where `school_id IS NULL`) is shared read-only;
  teacher notes are school-scoped; chats are student-owned.

## Changing the local model

The adapter contract is `chatJson(system, user)` + `embedTexts(texts)` + `ollamaHealth()`. Swap in
another local server (llama.cpp, LM Studio, vLLM) by rewriting **only** `src/lib/ai/ollama.ts`.

Changing the **embedding model**: set `EMBEDDING_DIM`, then
`ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(<dim>);` and update the `vector(768)` type
in `match_chunks()`. Re-run indexing (`approveDocument` / `syncPyqChunk`) to regenerate vectors —
chunks stay searchable via FTS meanwhile.

## Retention & deletion

- `schools.settings.retention_days` (default 90) drives `scripts/retention-cleanup.mjs`
  (schedule with cron). Students can delete their own chats; admins deactivate accounts (sessions
  banned). Audit logs are retained (configurable) as the record of administrative changes.
- What is stored, why, and who can see it: see `PRIVACY.md`.

## Demo data

Everything seeded by `supabase/seed_demo.sql` is tagged `[DEMO]` and the demo accounts use
`@demo.sahayak` emails. Remove before production.
