-- Migration 5: RAG pipeline — documents (PDF ingestion with admin review),
-- per-page extracted text (page numbers preserved), and searchable chunks with
-- embeddings (pgvector) plus full-text search fallback.
-- EMBEDDING_DIM default is 768 (nomic-embed-text via Ollama). If you change the
-- embedding model, alter chunks.embedding and the match_chunks signature.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_scope text not null default 'master' check (owner_scope in ('master','school')),
  school_id uuid references public.schools(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete set null,
  textbook_id uuid references public.textbooks(id) on delete set null,
  kind text not null default 'textbook' check (kind in ('textbook','syllabus','teacher_notes','pyq','other')),
  title text not null,
  storage_path text not null,
  page_count int,
  status text not null default 'uploaded' check (status in ('uploaded','extracted','indexed','rejected')),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_documents_subject on public.documents(subject_id, status);

create table public.document_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  page_number int not null,
  content text not null default '',
  status text not null default 'pending' check (status in ('pending','needs_ocr','edited','approved')),
  unique (document_id, page_number)
);
create index idx_document_pages_doc on public.document_pages(document_id, page_number);

create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  page_number int,
  school_id uuid references public.schools(id) on delete cascade,  -- null = master (shared)
  subject_id uuid not null references public.subjects(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  source_type text not null check (source_type in ('textbook','syllabus','teacher_notes','pyq','practice_question')),
  source_title text not null,
  exam_year int,
  question_no text,
  pyq_id uuid references public.pyqs(id) on delete cascade,
  note_id uuid references public.school_notes(id) on delete cascade,
  content text not null,
  embedding vector(768),
  content_tsv tsvector generated always as (to_tsvector('english', content)) stored,
  status text not null default 'approved' check (status in ('approved','pending')),
  created_at timestamptz not null default now()
);
create index idx_chunks_subject on public.chunks(subject_id);
create index idx_chunks_school on public.chunks(school_id);
create index idx_chunks_fts on public.chunks using gin(content_tsv);
create index idx_chunks_embedding on public.chunks using hnsw (embedding vector_cosine_ops);

-- Semantic search over approved chunks, scoped to a subject (and optionally a
-- chapter), limited to master material + the caller's school. Called ONLY by
-- the application backend.
create or replace function public.match_chunks(
  p_query_embedding vector(768),
  p_subject uuid,
  p_school uuid,
  p_chapter uuid default null,
  p_exclude_topics uuid[] default '{}',
  p_match_count int default 6
)
returns table (
  id uuid, content text, page_number int, source_type text, source_title text,
  chapter_id uuid, topic_id uuid, exam_year int, question_no text, similarity float
)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.content, c.page_number, c.source_type, c.source_title,
         c.chapter_id, c.topic_id, c.exam_year, c.question_no,
         1 - (c.embedding <=> p_query_embedding) as similarity
  from public.chunks c
  where c.embedding is not null
    and c.status = 'approved'
    and c.subject_id = p_subject
    and (c.school_id is null or c.school_id = p_school)
    and (p_chapter is null or c.chapter_id = p_chapter)
    and (c.topic_id is null or not (c.topic_id = any(p_exclude_topics)))
  order by c.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1);
$$;

-- Keyword (full-text) fallback so grounded answers still work when embeddings
-- are unavailable (e.g. local model offline during indexing).
create or replace function public.fts_chunks(
  p_query text,
  p_subject uuid,
  p_school uuid,
  p_chapter uuid default null,
  p_exclude_topics uuid[] default '{}',
  p_match_count int default 6
)
returns table (
  id uuid, content text, page_number int, source_type text, source_title text,
  chapter_id uuid, topic_id uuid, exam_year int, question_no text, similarity float
)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.content, c.page_number, c.source_type, c.source_title,
         c.chapter_id, c.topic_id, c.exam_year, c.question_no,
         ts_rank(c.content_tsv, plainto_tsquery('english', p_query)) as similarity
  from public.chunks c
  where c.status = 'approved'
    and c.content_tsv @@ plainto_tsquery('english', p_query)
    and c.subject_id = p_subject
    and (c.school_id is null or c.school_id = p_school)
    and (p_chapter is null or c.chapter_id = p_chapter)
    and (c.topic_id is null or not (c.topic_id = any(p_exclude_topics)))
  order by similarity desc
  limit greatest(p_match_count, 1);
$$;

-- Private storage bucket for uploaded PDFs. Access happens only through the
-- backend with the service-role key; the model server and browsers never talk
-- to storage directly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;
