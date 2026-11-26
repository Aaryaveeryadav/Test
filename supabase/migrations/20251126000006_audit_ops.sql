-- Migration 6: Audit log (sensitive administrative changes) and rate limiting.

create table public.audit_logs (
  id bigserial primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_school on public.audit_logs(school_id, created_at desc);
create index idx_audit_actor on public.audit_logs(actor_id, created_at desc);
create index idx_audit_action on public.audit_logs(action, created_at desc);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- Atomic sliding-window rate limiter used by src/lib/ratelimit.ts.
-- Returns true when the request is within the allowed maximum.
create or replace function public.rate_limit_hit(
  p_key text,
  p_window_seconds int,
  p_max int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket timestamptz := to_timestamp(
    floor(extract(epoch from now()) / greatest(p_window_seconds, 1)) * greatest(p_window_seconds, 1)
  );
  n int;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, bucket, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into n;
  return n <= p_max;
end $$;
