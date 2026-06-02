create table if not exists public.student_risk_snapshots (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  snapshot_date date not null,
  feature_version text not null default 'v1',
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (student_id, snapshot_date, feature_version)
);

create index if not exists idx_student_risk_snapshots_student_date
  on public.student_risk_snapshots (student_id, snapshot_date desc);

create index if not exists idx_student_risk_snapshots_snapshot_date
  on public.student_risk_snapshots (snapshot_date desc);

create index if not exists idx_student_risk_snapshots_institution_id
  on public.student_risk_snapshots (institution_id);

create table if not exists public.student_risk_predictions (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.student_risk_snapshots(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  prediction_date date not null default current_date,
  model_version text not null,
  risk_score numeric(5,4) not null check (risk_score >= 0 and risk_score <= 1),
  risk_band text not null check (risk_band in ('low', 'medium', 'high')),
  reason_codes text[] not null default '{}'::text[],
  explanation text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_id, model_version)
);

create index if not exists idx_student_risk_predictions_student_id
  on public.student_risk_predictions (student_id);

create index if not exists idx_student_risk_predictions_snapshot_id
  on public.student_risk_predictions (snapshot_id);

create index if not exists idx_student_risk_predictions_prediction_date
  on public.student_risk_predictions (prediction_date desc);

create index if not exists idx_student_risk_predictions_institution_id
  on public.student_risk_predictions (institution_id);

create table if not exists public.risk_feedback (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references public.student_risk_predictions(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  feedback_type text not null check (
    feedback_type in ('useful', 'false_alarm', 'student_recovered', 'intervention_sent', 'other')
  ),
  notes text,
  created_at timestamptz not null default now(),
  unique (prediction_id, reviewer_id)
);

create index if not exists idx_risk_feedback_prediction_id
  on public.risk_feedback (prediction_id);

create index if not exists idx_risk_feedback_reviewer_id
  on public.risk_feedback (reviewer_id);

create index if not exists idx_risk_feedback_institution_id
  on public.risk_feedback (institution_id);

grant select on public.student_risk_snapshots to authenticated;
grant select on public.student_risk_predictions to authenticated;
grant select, insert on public.risk_feedback to authenticated;
grant insert, update on public.student_risk_snapshots to service_role;
grant insert, update on public.student_risk_predictions to service_role;

alter table public.student_risk_snapshots enable row level security;
alter table public.student_risk_predictions enable row level security;
alter table public.risk_feedback enable row level security;

create or replace function public.sync_student_risk_snapshot_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
    private.user_institution_id(new.student_id),
    private.default_institution_id()
  );
  return new;
end;
$$;

create or replace function public.sync_student_risk_prediction_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
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

create or replace function public.sync_risk_feedback_institution_id()
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
    private.user_institution_id(new.reviewer_id),
    private.default_institution_id()
  );
  return new;
end;
$$;

drop trigger if exists sync_student_risk_snapshot_institution_id on public.student_risk_snapshots;
create trigger sync_student_risk_snapshot_institution_id
  before insert or update on public.student_risk_snapshots
  for each row
  execute function public.sync_student_risk_snapshot_institution_id();

drop trigger if exists sync_student_risk_prediction_institution_id on public.student_risk_predictions;
create trigger sync_student_risk_prediction_institution_id
  before insert or update on public.student_risk_predictions
  for each row
  execute function public.sync_student_risk_prediction_institution_id();

drop trigger if exists sync_risk_feedback_institution_id on public.risk_feedback;
create trigger sync_risk_feedback_institution_id
  before insert or update on public.risk_feedback
  for each row
  execute function public.sync_risk_feedback_institution_id();

drop policy if exists "Admins can read student risk snapshots" on public.student_risk_snapshots;
create policy "Admins can read student risk snapshots"
  on public.student_risk_snapshots for select
  to authenticated
  using (
    public.is_admin()
    and private.same_institution(institution_id)
  );

drop policy if exists "Admins can read student risk predictions" on public.student_risk_predictions;
create policy "Admins can read student risk predictions"
  on public.student_risk_predictions for select
  to authenticated
  using (
    public.is_admin()
    and private.same_institution(institution_id)
  );

drop policy if exists "Admins can read risk feedback" on public.risk_feedback;
create policy "Admins can read risk feedback"
  on public.risk_feedback for select
  to authenticated
  using (
    public.is_admin()
    and private.same_institution(institution_id)
  );

drop policy if exists "Admins can insert risk feedback" on public.risk_feedback;
create policy "Admins can insert risk feedback"
  on public.risk_feedback for insert
  to authenticated
  with check (
    public.is_admin()
    and private.same_institution(institution_id)
  );
