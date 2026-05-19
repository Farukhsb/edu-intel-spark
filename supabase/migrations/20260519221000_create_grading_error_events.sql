create table if not exists public.grading_error_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid null,
  assignment_id uuid null,
  user_id uuid null,
  provider text null,
  error_code text not null,
  error_message text null,
  safe_error_category text not null default 'grading_failure',
  created_at timestamptz not null default now()
);

alter table public.grading_error_events enable row level security;

grant select on public.grading_error_events to authenticated;
grant insert on public.grading_error_events to service_role;

create policy "Admins can read grading error events"
on public.grading_error_events
for select
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
