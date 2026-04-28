create table if not exists public.assignment_cohorts (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  cohort_id text not null,
  created_at timestamptz not null default now(),
  primary key (assignment_id, cohort_id)
);

create index if not exists assignment_cohorts_cohort_id_idx
  on public.assignment_cohorts (cohort_id);

alter table public.assignment_cohorts enable row level security;

drop policy if exists "Lecturers can manage own assignment cohorts" on public.assignment_cohorts;

create policy "Lecturers can manage own assignment cohorts"
on public.assignment_cohorts
for all
to authenticated
using (
  exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and a.lecturer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and a.lecturer_id = auth.uid()
  )
);
