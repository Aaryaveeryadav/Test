-- Migration 4: Learning data — assignments & quizzes, submissions, practice
-- attempts, tutoring chats and messages (with citations, diagrams, and the
-- "flag for teacher review" workflow).

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  school_class_id uuid not null references public.school_classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);
create index idx_assignments_class on public.assignments(school_class_id, subject_id);

create table public.assignment_questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  kind text not null check (kind in ('mcq','subjective')),
  question_text text not null,
  options jsonb,
  correct_option int,
  marks int not null default 1,
  position int not null default 0
);
create index idx_assignment_questions_assignment on public.assignment_questions(assignment_id);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted','graded')),
  score numeric,
  feedback text,
  graded_by uuid references public.profiles(id) on delete set null,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index idx_submissions_assignment on public.submissions(assignment_id);

create table public.submission_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  question_id uuid not null references public.assignment_questions(id) on delete cascade,
  answer_text text,
  selected_option int,
  correct boolean,
  marks_awarded numeric
);

-- Progress is calculated ONLY from recorded practice/assignment results —
-- never inferred from chat.
create table public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  source text not null default 'pyq' check (source in ('pyq','teacher_question','self','assignment')),
  question_ref text,
  correct boolean not null,
  created_at timestamptz not null default now()
);
create index idx_attempts_student on public.practice_attempts(student_id, subject_id);
create index idx_attempts_topic on public.practice_attempts(topic_id);
create index idx_attempts_class_topic on public.practice_attempts(subject_id, topic_id);

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete set null,
  title text not null default 'New question',
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index idx_chats_student on public.chats(student_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  mode text,
  answer_case text,
  label text,
  concept text,
  citations jsonb,
  diagram jsonb,
  needs_followup text,
  flag_status text not null default 'none' check (flag_status in ('none','flagged','resolved')),
  flag_note text,
  review_note text,
  created_at timestamptz not null default now()
);
create index idx_messages_chat on public.messages(chat_id, created_at);
create index idx_messages_flagged on public.messages(flag_status) where flag_status <> 'none';
