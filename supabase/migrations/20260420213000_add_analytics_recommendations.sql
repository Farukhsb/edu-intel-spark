create table if not exists public.analytics_recommendations (
  id text primary key,
  lecturer_id uuid not null references public.profiles(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete set null,
  type text not null,
  rule_code text not null,
  title text not null,
  summary text not null,
  explanation text not null,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  confidence numeric not null default 0.9,
  recommended_actions jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'actioned')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_analytics_recommendations_lecturer_id
  on public.analytics_recommendations (lecturer_id);

create index if not exists idx_analytics_recommendations_status
  on public.analytics_recommendations (status);

create table if not exists public.recommendation_actions (
  id uuid primary key default gen_random_uuid(),
  recommendation_id text not null references public.analytics_recommendations(id) on delete cascade,
  lecturer_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null check (action_type in ('review', 'dismiss', 'create_intervention')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_recommendation_actions_recommendation_id
  on public.recommendation_actions (recommendation_id);

create index if not exists idx_recommendation_actions_lecturer_id
  on public.recommendation_actions (lecturer_id);

alter table public.analytics_recommendations enable row level security;
alter table public.recommendation_actions enable row level security;

drop policy if exists "Lecturers can view own analytics recommendations" on public.analytics_recommendations;
create policy "Lecturers can view own analytics recommendations"
on public.analytics_recommendations
for select
to authenticated
using (lecturer_id = auth.uid());

drop policy if exists "Lecturers can insert own analytics recommendations" on public.analytics_recommendations;
create policy "Lecturers can insert own analytics recommendations"
on public.analytics_recommendations
for insert
to authenticated
with check (lecturer_id = auth.uid());

drop policy if exists "Lecturers can update own analytics recommendations" on public.analytics_recommendations;
create policy "Lecturers can update own analytics recommendations"
on public.analytics_recommendations
for update
to authenticated
using (lecturer_id = auth.uid())
with check (lecturer_id = auth.uid());

drop policy if exists "Lecturers can view own recommendation actions" on public.recommendation_actions;
create policy "Lecturers can view own recommendation actions"
on public.recommendation_actions
for select
to authenticated
using (lecturer_id = auth.uid());

drop policy if exists "Lecturers can insert own recommendation actions" on public.recommendation_actions;
create policy "Lecturers can insert own recommendation actions"
on public.recommendation_actions
for insert
to authenticated
with check (lecturer_id = auth.uid());

drop trigger if exists update_analytics_recommendations_updated_at on public.analytics_recommendations;
create trigger update_analytics_recommendations_updated_at
before update on public.analytics_recommendations
for each row
execute function public.update_updated_at_column();
