create table if not exists public.student_risk_outcomes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  prediction_id uuid references public.student_risk_predictions(id) on delete set null,
  snapshot_id uuid references public.student_risk_snapshots(id) on delete set null,
  outcome_date date not null default current_date,
  label_window_days integer not null default 30 check (label_window_days > 0),
  label_value text not null check (label_value in ('low', 'medium', 'high')),
  outcome_status text not null check (
    outcome_status in ('passed', 'at_risk', 'failed', 'withdrawn', 'incomplete')
  ),
  outcome_source text not null check (outcome_source in ('manual', 'grade', 'import', 'system')),
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_student_risk_outcomes_unique
  on public.student_risk_outcomes (student_id, outcome_date, label_window_days, outcome_source);

create index if not exists idx_student_risk_outcomes_student_id
  on public.student_risk_outcomes (student_id);

create index if not exists idx_student_risk_outcomes_prediction_id
  on public.student_risk_outcomes (prediction_id);

create index if not exists idx_student_risk_outcomes_snapshot_id
  on public.student_risk_outcomes (snapshot_id);

create index if not exists idx_student_risk_outcomes_outcome_date
  on public.student_risk_outcomes (outcome_date desc);

create index if not exists idx_student_risk_outcomes_institution_id
  on public.student_risk_outcomes (institution_id);

grant select on public.student_risk_outcomes to authenticated;
grant select, insert, update on public.student_risk_outcomes to service_role;

alter table public.student_risk_outcomes enable row level security;

create or replace function public.sync_student_risk_outcome_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
    (
      select rp.institution_id
      from public.student_risk_predictions rp
      where rp.id = new.prediction_id
    ),
    (
      select ss.institution_id
      from public.student_risk_snapshots ss
      where ss.id = new.snapshot_id
    ),
    private.user_institution_id(new.student_id),
    private.default_institution_id()
  );
  return new;
end;
$$;

drop trigger if exists sync_student_risk_outcome_institution_id on public.student_risk_outcomes;
create trigger sync_student_risk_outcome_institution_id
  before insert or update on public.student_risk_outcomes
  for each row
  execute function public.sync_student_risk_outcome_institution_id();

drop policy if exists "Admins can read student risk outcomes" on public.student_risk_outcomes;
create policy "Admins can read student risk outcomes"
  on public.student_risk_outcomes for select
  to authenticated
  using (
    public.is_admin()
    and private.same_institution(institution_id)
  );

drop policy if exists "Admins can insert student risk outcomes" on public.student_risk_outcomes;
create policy "Admins can insert student risk outcomes"
  on public.student_risk_outcomes for insert
  to authenticated
  with check (
    public.is_admin()
    and private.same_institution(institution_id)
  );

drop policy if exists "Admins can update student risk outcomes" on public.student_risk_outcomes;
create policy "Admins can update student risk outcomes"
  on public.student_risk_outcomes for update
  to authenticated
  using (
    public.is_admin()
    and private.same_institution(institution_id)
  )
  with check (
    public.is_admin()
    and private.same_institution(institution_id)
  );
