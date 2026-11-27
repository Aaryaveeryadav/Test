-- Migration 3: Schools, users, school classes, enrollments, teacher assignments,
-- topic overrides (include/exclude/emphasize), teacher notes, signup requests,
-- and invitations.
-- NOTE: school_id is denormalized onto child tables so Row Level Security can
-- scope every row to a school without joins.

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  board_id uuid references public.boards(id) on delete set null,
  address text,
  status text not null default 'active' check (status in ('active','suspended')),
  settings jsonb not null default '{"ranking_enabled": false, "retention_days": 90}'::jsonb,
  created_at timestamptz not null default now()
);

-- One profile per auth user. The role is ALWAYS read from this trusted server
-- record — never chosen in a form.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('master_admin','school_admin','teacher','student')),
  school_id uuid references public.schools(id) on delete cascade,
  status text not null default 'active' check (status in ('active','inactive')),
  roll_number text,
  phone text,                       -- optional; collected only if school requires it
  guardian_name text,
  guardian_contact text,
  guardian_consent boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_profiles_school on public.profiles(school_id);
create index idx_profiles_role on public.profiles(role, status);

create table public.school_classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  section text not null default 'A',
  academic_year text not null default to_char(now(), 'YYYY'),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (school_id, class_id, section, academic_year)
);
create index idx_school_classes_school on public.school_classes(school_id);

create table public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  school_class_id uuid not null references public.school_classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (school_class_id, subject_id)
);

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  school_class_id uuid not null references public.school_classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_id, school_class_id, subject_id)
);
create index idx_teacher_assignments_teacher on public.teacher_assignments(teacher_id);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  school_class_id uuid not null references public.school_classes(id) on delete cascade,
  status text not null default 'active' check (status in ('active','removed')),
  created_at timestamptz not null default now(),
  unique (student_id, school_class_id)
);
create index idx_enrollments_student on public.enrollments(student_id);
create index idx_enrollments_class on public.enrollments(school_class_id);

-- Teachers mark topics included / excluded / emphasized FOR THEIR CLASS only.
-- This never changes the master curriculum.
create table public.topic_overrides (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  school_class_id uuid not null references public.school_classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  state text not null check (state in ('included','excluded','emphasized')),
  updated_at timestamptz not null default now(),
  unique (school_class_id, topic_id)
);

-- School-specific notes / emphasis / practice questions created by teachers.
-- Kept separate from the master curriculum (which teachers cannot edit).
create table public.school_notes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  school_class_id uuid references public.school_classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'note' check (kind in ('note','practice_question')),
  title text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now()
);
create index idx_school_notes_scope on public.school_notes(school_id, subject_id, status);

-- Student/teacher access requests. No public teacher signup: teacher requests
-- must be approved by a school or master administrator.
create table public.signup_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  requested_role text not null check (requested_role in ('student','teacher')),
  requested_class_id uuid references public.classes(id) on delete set null,
  email text not null,
  full_name text not null,
  roll_number text,
  guardian_name text,
  guardian_contact text,
  guardian_consent boolean not null default false,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_signup_requests_school on public.signup_requests(school_id, status);
create index idx_signup_requests_email on public.signup_requests(email);

-- Teacher / school-admin invitations (secret link, expires).
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  role text not null check (role in ('teacher','school_admin')),
  email text not null,
  full_name text not null default '',
  token text not null unique default gen_random_uuid()::text,
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','used','revoked')),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
create index idx_invitations_school on public.invitations(school_id, status);
