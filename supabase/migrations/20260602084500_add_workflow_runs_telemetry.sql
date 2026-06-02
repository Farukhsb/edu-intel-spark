create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_name text not null,
  assignment_id uuid null,
  submission_id uuid null,
  institution_id uuid not null,
  triggered_by uuid null,
  provider text not null,
  model text null,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  retry_count integer not null default 0 check (retry_count >= 0),
  failure_category text null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  duration_ms integer null check (duration_ms is null or duration_ms >= 0),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workflow_runs enable row level security;

grant select on public.workflow_runs to authenticated;
grant insert, update on public.workflow_runs to service_role;

create index if not exists workflow_runs_institution_id_idx
  on public.workflow_runs (institution_id);

create index if not exists workflow_runs_workflow_name_idx
  on public.workflow_runs (workflow_name);

create index if not exists workflow_runs_started_at_idx
  on public.workflow_runs (started_at desc);

create index if not exists workflow_runs_status_idx
  on public.workflow_runs (status);

drop policy if exists "Admins can read workflow runs" on public.workflow_runs;
create policy "Admins can read workflow runs"
on public.workflow_runs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
      and private.same_institution(profiles.institution_id)
  )
  and private.same_institution(institution_id)
);
