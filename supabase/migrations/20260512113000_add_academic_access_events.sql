create table if not exists public.academic_access_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  actor_role text not null,
  event_type text not null,
  resource_type text not null,
  resource_id uuid,
  assignment_id uuid,
  submission_id uuid,
  moderation_case_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_academic_access_events_actor_id
  on public.academic_access_events (actor_id);

create index if not exists idx_academic_access_events_event_type
  on public.academic_access_events (event_type);

create index if not exists idx_academic_access_events_resource_type
  on public.academic_access_events (resource_type);

create index if not exists idx_academic_access_events_resource_id
  on public.academic_access_events (resource_id);

create index if not exists idx_academic_access_events_assignment_id
  on public.academic_access_events (assignment_id);

create index if not exists idx_academic_access_events_submission_id
  on public.academic_access_events (submission_id);

create index if not exists idx_academic_access_events_created_at
  on public.academic_access_events (created_at desc);

alter table public.academic_access_events enable row level security;

drop policy if exists "Users can insert own academic access events" on public.academic_access_events;
create policy "Users can insert own academic access events"
on public.academic_access_events
for insert
to authenticated
with check ((select auth.uid()) = actor_id);

drop policy if exists "Admins can view all academic access events" on public.academic_access_events;
create policy "Admins can view all academic access events"
on public.academic_access_events
for select
to authenticated
using (private.is_admin());

grant select, insert on public.academic_access_events to authenticated;
