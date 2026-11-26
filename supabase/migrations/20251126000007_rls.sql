-- Migration 7: Row Level Security — defense in depth.
-- The application backend enforces permissions on every request and performs
-- writes with the service-role key. These policies additionally restrict any
-- direct PostgREST/anon-key access, so a leaked anon key alone cannot read
-- another school's records.

-- Helpers (security definer to avoid RLS recursion on profiles).
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.my_school() returns uuid
language sql stable security definer set search_path = public as
$$ select school_id from public.profiles where id = auth.uid() $$;

create or replace function public.is_master() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'master_admin' from public.profiles where id = auth.uid()), false) $$;

create or replace function public.is_school_member(sid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and school_id = sid) $$;

grant execute on function public.my_role() to authenticated;
grant execute on function public.my_school() to authenticated;
grant execute on function public.is_master() to authenticated;
grant execute on function public.is_school_member(uuid) to authenticated;

alter table public.boards             enable row level security;
alter table public.classes            enable row level security;
alter table public.subjects           enable row level security;
alter table public.chapters           enable row level security;
alter table public.topics             enable row level security;
alter table public.formulas           enable row level security;
alter table public.textbooks          enable row level security;
alter table public.pyqs               enable row level security;
alter table public.schools            enable row level security;
alter table public.profiles           enable row level security;
alter table public.school_classes     enable row level security;
alter table public.class_subjects     enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.enrollments        enable row level security;
alter table public.topic_overrides    enable row level security;
alter table public.school_notes       enable row level security;
alter table public.signup_requests    enable row level security;
alter table public.invitations        enable row level security;
alter table public.assignments        enable row level security;
alter table public.assignment_questions enable row level security;
alter table public.submissions        enable row level security;
alter table public.submission_answers enable row level security;
alter table public.practice_attempts  enable row level security;
alter table public.chats              enable row level security;
alter table public.messages           enable row level security;
alter table public.documents          enable row level security;
alter table public.document_pages     enable row level security;
alter table public.chunks             enable row level security;
alter table public.audit_logs         enable row level security;
alter table public.rate_limits        enable row level security;

-- Master curriculum: readable by any authenticated user; writes only via backend.
create policy "curriculum_read_boards" on public.boards for select to authenticated using (true);
create policy "curriculum_read_classes" on public.classes for select to authenticated using (true);
create policy "curriculum_read_subjects" on public.subjects for select to authenticated using (true);
create policy "curriculum_read_chapters" on public.chapters for select to authenticated using (true);
create policy "curriculum_read_topics" on public.topics for select to authenticated using (true);
create policy "curriculum_read_formulas" on public.formulas for select to authenticated using (true);
create policy "curriculum_read_textbooks" on public.textbooks for select to authenticated using (true);
create policy "curriculum_read_pyqs" on public.pyqs for select to authenticated using (true);

create policy "schools_read" on public.schools for select to authenticated
  using (is_master() or is_school_member(id));

create policy "profiles_read" on public.profiles for select to authenticated
  using (id = auth.uid() or is_master() or (my_role() = 'school_admin' and school_id = my_school()));
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "school_classes_read" on public.school_classes for select to authenticated
  using (is_master() or is_school_member(school_id));
create policy "class_subjects_read" on public.class_subjects for select to authenticated
  using (is_master() or is_school_member(school_id));
create policy "teacher_assignments_read" on public.teacher_assignments for select to authenticated
  using (is_master() or is_school_member(school_id) or teacher_id = auth.uid());
create policy "enrollments_read" on public.enrollments for select to authenticated
  using (is_master() or is_school_member(school_id) or student_id = auth.uid());
create policy "topic_overrides_read" on public.topic_overrides for select to authenticated
  using (is_master() or is_school_member(school_id));

create policy "school_notes_read" on public.school_notes for select to authenticated
  using (is_master() or (is_school_member(school_id) and status = 'published'));

create policy "signup_requests_read" on public.signup_requests for select to authenticated
  using (is_master() or (my_role() = 'school_admin' and school_id = my_school()));
create policy "signup_requests_insert" on public.signup_requests for insert to anon, authenticated
  with check (true);
-- Access requests are submitted before login (anon). Rate limiting happens in
-- the backend; storage of minimal fields only.

create policy "invitations_read" on public.invitations for select to authenticated
  using (is_master() or (my_role() = 'school_admin' and school_id = my_school()));

create policy "assignments_read" on public.assignments for select to authenticated
  using (is_master() or is_school_member(school_id));
create policy "assignment_questions_read" on public.assignment_questions for select to authenticated
  using (exists (
    select 1 from public.assignments a
    where a.id = assignment_id and (is_master() or is_school_member(a.school_id))
  ));

create policy "submissions_read" on public.submissions for select to authenticated
  using (student_id = auth.uid() or is_master());
create policy "submission_answers_read" on public.submission_answers for select to authenticated
  using (exists (
    select 1 from public.submissions s
    where s.id = submission_id and (s.student_id = auth.uid() or is_master())
  ));

create policy "attempts_read" on public.practice_attempts for select to authenticated
  using (student_id = auth.uid() or is_master());
create policy "attempts_insert_own" on public.practice_attempts for insert to authenticated
  with check (student_id = auth.uid());

create policy "chats_read" on public.chats for select to authenticated
  using (student_id = auth.uid() or is_master());
create policy "chats_insert_own" on public.chats for insert to authenticated
  with check (student_id = auth.uid());
create policy "chats_delete_own" on public.chats for delete to authenticated
  using (student_id = auth.uid());

create policy "messages_read" on public.messages for select to authenticated
  using (exists (
    select 1 from public.chats c
    where c.id = chat_id and (c.student_id = auth.uid() or is_master())
  ));

create policy "documents_read" on public.documents for select to authenticated
  using ((owner_scope = 'master' and is_master()) or (school_id is not null and is_school_member(school_id)));
create policy "document_pages_read" on public.document_pages for select to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = document_id
      and ((d.owner_scope = 'master' and is_master()) or (d.school_id is not null and is_school_member(d.school_id)))
  ));

create policy "chunks_read" on public.chunks for select to authenticated
  using (school_id is null or is_school_member(school_id));

create policy "audit_read" on public.audit_logs for select to authenticated
  using (is_master() or (my_role() = 'school_admin' and school_id = my_school()));

-- rate_limits: no policies — accessible only to the backend service role.
