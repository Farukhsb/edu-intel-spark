create extension if not exists pgcrypto;

create table if not exists public.student_interventions (
  id uuid primary key default gen_random_uuid(),
  lecturer_id uuid not null,
  student_id uuid null,
  student_name text not null,
  student_email text null,
  intervention_type text not null check (intervention_type in ('email', 'meeting', 'feedback', 'support_referral', 'check_in', 'other')),
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'resolved')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  title text not null,
  notes text null,
  follow_up_date timestamptz null,
  assignment_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_interventions_lecturer_id on public.student_interventions (lecturer_id);
create index if not exists idx_student_interventions_student_id on public.student_interventions (student_id);
create index if not exists idx_student_interventions_status on public.student_interventions (status);
create index if not exists idx_student_interventions_follow_up_date on public.student_interventions (follow_up_date);

create or replace function public.update_student_interventions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_student_interventions_updated_at on public.student_interventions;
create trigger trg_student_interventions_updated_at
before update on public.student_interventions
for each row
execute function public.update_student_interventions_updated_at();

alter table public.student_interventions enable row level security;

drop policy if exists "Lecturers can view their own interventions" on public.student_interventions;
create policy "Lecturers can view their own interventions"
on public.student_interventions
for select
using (auth.uid() = lecturer_id);

drop policy if exists "Lecturers can create their own interventions" on public.student_interventions;
create policy "Lecturers can create their own interventions"
on public.student_interventions
for insert
with check (auth.uid() = lecturer_id);

drop policy if exists "Lecturers can update their own interventions" on public.student_interventions;
create policy "Lecturers can update their own interventions"
on public.student_interventions
for update
using (auth.uid() = lecturer_id)
with check (auth.uid() = lecturer_id);

drop policy if exists "Lecturers can delete their own interventions" on public.student_interventions;
create policy "Lecturers can delete their own interventions"
on public.student_interventions
for delete
using (auth.uid() = lecturer_id);
