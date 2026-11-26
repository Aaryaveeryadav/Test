-- Migration 2: Master curriculum (boards → classes → subjects → chapters → topics),
-- formulas, textbooks, and previous-year questions (PYQs).
-- Owned and edited ONLY by the master administrator (via the backend).

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  grade int not null check (grade between 1 and 14),
  label text,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  unique (board_id, grade)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  code text not null,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  unique (class_id, code)
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  number int not null,
  title text not null,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  unique (subject_id, number)
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now()
);

create table public.formulas (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  title text not null,
  expression text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.textbooks (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  author text,
  publisher text,
  edition text,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now()
);

-- Previous-year questions with full citation metadata (board/class/subject come
-- from the referenced subject; year and question number are stored here).
create table public.pyqs (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete set null,
  year int not null,
  exam text not null default 'Board Exam',
  question_no text,
  question_text text not null,
  marks int,
  answer_text text,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now()
);

create index idx_classes_board on public.classes(board_id);
create index idx_subjects_class on public.subjects(class_id);
create index idx_chapters_subject on public.chapters(subject_id);
create index idx_topics_chapter on public.topics(chapter_id);
create index idx_formulas_chapter on public.formulas(chapter_id);
create index idx_pyqs_subject on public.pyqs(subject_id, year);
