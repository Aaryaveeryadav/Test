# Sahayak — Secure Study Platform for Class 10 & 12

A secure, mobile-friendly study platform for Indian schools: students ask questions and practise,
teachers manage their assigned classes, school administrators run one school, and a master
administrator controls the platform. AI answers come **only** from a **local model** (Ollama on
your RTX 3050 machine), grounded by **RAG** over administrator-approved material — with **no cloud
AI and no automatic cloud fallback**.

**Stack:** Next.js 15 (React 19, TypeScript) · Node.js runtime · Supabase (PostgreSQL + pgvector +
Auth + Storage) · Tailwind CSS · Ollama (replaceable adapter).

> ⚠️ AI answers are **never guaranteed correct**. Students are always told to verify with textbooks
> and teachers, and can flag any answer for teacher review.

---

## Contents

1. [Features](#features)
2. [Quick start (local dev)](#quick-start-local-dev)
3. [Loading demo data](#loading-demo-data)
4. [The local model (RTX 3050)](#the-local-model-rtx-3050)
5. [Production deployment](#production-deployment)
6. [Security model](#security-model)
7. [Known gaps & assumptions](#known-gaps--assumptions)

## Features

**Grounded tutor (`/student/tutor`)**
- RAG over approved textbooks, syllabus material, teacher notes and previous-year questions,
  with citations (board, class, subject, chapter, **page number**, exam year, question number).
- Three answer cases, enforced in code as well as in the prompt:
  1. **Covered** — answered from retrieved passages, references shown.
  2. **Application/Extension** — allowed only if it fits an enabled syllabus topic; labeled as such
     and never claimed to be from a book or PYQ.
  3. **Outside scope** — polite refusal limited to the student's enabled board/class/subject/topics.
  4. *Unclear* questions get one short follow-up instead of a guess.
- Four selectable learning modes: simple explanation · step-by-step solution · board-exam answer ·
  alternate method/analogy (the tutor honestly says when only one valid method exists).
- Safe diagrams: geometry figures, graphs, timelines, concept maps and circuits are generated from
  **validated structured data** (Zod schema) and rendered as SVG. Arbitrary model HTML/SVG is never
  rendered. Each figure carries an accessibility description.
- Chat with follow-ups, clear scope bar (school → board → class → subject → chapter), model-status
  indicator, and per-answer **flag for teacher review**.
- If the local model is offline/overloaded students get a clear error — never a silent switch to a
  hosted AI provider.

**Roles & school separation**
- One login page for everyone; the role always comes from the trusted server-side `profiles` row,
  never from a form choice.
- `master_admin` — boards, classes, subjects, chapters, topics, formulas, textbooks, PYQs, document
  ingestion, schools (create/suspend/reactivate), platform audit log. Provisioned only via script.
- `school_admin` — approvals (students + teacher requests), invitations, classes/enrollments/
  teacher assignments, users, school audit log.
- `teacher` — only assigned class+subject pairs: explicit class selector, class dashboard with
  topic-level results, topic planning (include/exclude/**emphasize**), class notes & practice
  questions, assignments/quizzes with MCQ auto-grading + subjective review, flagged-answer review,
  optional class ranking (only if the school enables it, inside the class only).
- `student` — enrolled school/board/class/subjects only: dashboard, per-chapter study pages,
  tutor chat, practice (PYQs + teacher questions), assignments, progress from recorded attempts.
- Backend authorization on every request (middleware + server actions + RLS as defense in depth);
  school data is always scoped by school ID.

**Curriculum & documents**
- Master admin CRUD for the whole curriculum with archive (soft-hide) instead of destructive delete.
- PDF upload → server-side text extraction (per-page, page numbers preserved) → **administrator
  page-by-page review** → approve & index → pgvector embeddings + full-text search.
- PYQs entered manually are embedded with year/question-number metadata for citations.

**Privacy & ops**
- Passwords handled by Supabase Auth (salted, modern hashing). Sessions are httpOnly cookies
  validated server-side on every request.
- Rate limits (Postgres-backed), audit logs for sensitive changes, account/school suspension that
  revokes even live sessions.
- Data minimisation: no Aadhaar, optional phone, guardian consent for students, per-school chat
  retention with a cleanup script, students can delete their own chats.
- Secrets only in env files (`.env.example` has placeholders; `.env*` is git-ignored).

## Quick start (local dev)

```bash
# 1. Create a Supabase project (https://supabase.com → New project).
#    Apply the migrations in supabase/migrations/ (Supabase CLI:
#      supabase link --project-ref <ref> && supabase db push
#    — or paste each file, in filename order, into the SQL editor).
#    Note: 20251126000005 creates the private `documents` storage bucket too.

# 2. Configure env
cp .env.example .env.local
#    Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#    SUPABASE_SERVICE_ROLE_KEY (Project Settings → API).

# 3. Install & run
npm install
npm run dev            # http://localhost:3000

# 4. Provision the first master administrator (never via public signup)
npm run master:admin -- you@example.com 'A-Strong-Password' 'Your Name'
#    (or: node --env-file=.env.local scripts/create-master-admin.mjs …)

# 5. Start Ollama on your GPU machine and pull the models
ollama pull llama3.1:8b
ollama pull nomic-embed-text
#    Set OLLAMA_BASE_URL if Ollama runs on another machine.
```

Sign in as the master admin → **Schools** → create a school (you get a signup code) → invite a
school admin → as school admin: create a class section, add subjects, enroll students, assign
teachers. Students sign up with the school code + roll number and wait for approval.

## Loading demo data

`supabase/seed_demo.sql` inserts **clearly marked [DEMO]** content (CBSE board, Class 10 Science/
Maths, Class 12 Physics, chapters/topics/formulas/PYQs, and “Demo Public School”, code `DEMO100`).
Then create demo accounts:

```bash
npm run seed:users     # master/admin/teacher/student1..3 @demo.sahayak
# password comes from DEMO_SEED_PASSWORD in .env.local
```

All demo rows are tagged `[DEMO]` so you can find and remove them before production.

## The local model (RTX 3050)

- Chat model default `llama3.1:8b` (Q4_K_M ≈ 4.9 GB — fits a 6–8 GB 3050; adjust
  `OLLAMA_CHAT_MODEL`, e.g. `qwen2.5:7b` or `gemma2:9b` if you prefer).
- Embeddings default `nomic-embed-text` (768-dim). If you change the embedding model, update
  `chunks.embedding` + `match_chunks()` (see ARCHITECTURE → *Changing the local model*).
- Concurrency is capped (`AI_MAX_CONCURRENT`, default 2) so a single GPU isn't overwhelmed;
  extra requests get a clear “busy” message.
- **Network layout:** only the backend talks to Ollama. Locally that's `http://127.0.0.1:11434`.
  From a hosted backend (e.g. Vercel), reach the GPU machine over a private tunnel
  (Tailscale/WireGuard) — never expose Ollama to the public internet. The browser never
  contacts the model server directly.

## The answer store (pre-generated answers)

Like Upay, Sahayak keeps **one reusable answer per question** in the `answer_store` table:

- When a student asks a question that is already in the store, the answer is served **instantly
  from the database** — the GPU doesn't even wake up, and the question doesn't count against the
  fair-use model limits. The reply carries an “Instant — from the answer store” badge.
- When the tutor answers a new grounded question (case *covered* with real citations), the answer
  is saved to the store automatically, so the next student asking the same thing gets it instantly.
  Only grounded answers are stored — extension or out-of-scope replies are never reused as grounded.
- Pre-generate answers for the whole PYQ bank **before** students need them, on the machine that
  has Ollama:

  ```bash
  node --env-file=.env.local scripts/build-answer-store.mjs --limit 40
  # options: --subject <uuid>  --year 2023  --verified  --force
  ```

  The script uses the shared “four-approaches” policy (`scripts/solve-policy.json`): at least four
  genuinely distinct approaches, honest method labels (never calling a verification a derivation),
  candidate substitution checks, Unicode maths, and citations only from retrieved passages or the
  official model answer on record.

## Bilingual UI (en / हिंदी) and offline PWA

- **Language toggle (EN | हिं)** is in the sidebar footer and on the landing page. The choice is
  stored in a cookie; server components render the chosen language without flashing. Stage 1
  covers the brand, landing, nav, and student dashboard — extend `src/lib/i18n.ts` page by page
  (untranslated strings fall back to English).
- **Offline PWA:** `public/sw.js` caches static assets (stale-while-revalidate), serves recent
  pages with a styled `offline.html` fallback, and **never** caches `/api/*` — tutor answers and
  data always come live from the server. Installable via `public/manifest.webmanifest`.

## Production deployment

- Deploy the Next.js app to Vercel (or any Node host): set the same env vars there.
- Run the Supabase migrations on the production project.
- Provision the master admin with the script (run locally with production env).
- Schedule `npm run retention:cleanup` (cron/Vercel Cron) for chat retention.
- Keep payments and any production-hardening (CSP, WAF, backups, SMTP for invitations) as
  separate follow-ups — they are intentionally out of this MVP.

## Security model

| Layer | What it does |
| --- | --- |
| Middleware | Validates the session (`getUser`), loads role/status from `profiles`, blocks non-members per area, blocks suspended schools/users (kills effective access, incl. live sessions) |
| Server actions/routes | Re-check role + school scope per request; validate input (Zod-style checks); write audit logs for sensitive changes |
| Supabase RLS | Defense in depth: anon/authenticated clients can only see their own/school rows even if keys leak; writes go through the backend |
| Rate limits | Postgres-backed windows on signup requests and the tutor endpoint |
| Audit logs | `audit_logs` records approvals, suspensions, curriculum edits, grading, invitations |

Passwords are never stored in this codebase — Supabase Auth handles them. The service-role key is
used **only** in server code (`src/lib/supabase/admin.ts`, `import 'server-only'`).

## Known gaps & assumptions (real-school input needed)

- **OCR for scanned PDFs is not included** — pages without a text layer are marked `needs OCR`;
  type the content manually or wire up a local OCR step (e.g. Tesseract) later.
- **Email is not configured** — approvals show a one-time password to share manually, and
  invitations are secret links. Add SMTP in Supabase for automated emails.
- **Guardian consent** is collected as an attestation at signup; have the school's legal/compliance
  review it under the DPDP Act and school policy before going live.
- **Document upload** is master-admin only in this MVP (school admins add notes as text).
- **Ranking** is a simple mastery table — restricted to the class and toggleable per school.
- **Exam-topic predictions** are labeled as *estimates* everywhere; they are not guarantees.
- The demo curriculum is illustrative — verify chapters/marks against real board syllabi before
  production, and only ingest material you have the rights to use.
- `supabase gen types` type generation for the client is a recommended hardening step.
