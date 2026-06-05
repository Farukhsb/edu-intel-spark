create table if not exists public.risk_model_registry (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  version text not null,
  status text not null check (status in ('training', 'active', 'archived', 'failed')),
  source text not null default 'historical_outcomes',
  artifact jsonb not null,
  metrics jsonb not null default '{}'::jsonb,
  trained_at timestamptz not null default now(),
  trained_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_risk_model_registry_institution_version
  on public.risk_model_registry (institution_id, version);

create index if not exists idx_risk_model_registry_institution_status
  on public.risk_model_registry (institution_id, status, trained_at desc);

grant select on public.risk_model_registry to authenticated;
grant select, insert, update on public.risk_model_registry to service_role;

alter table public.risk_model_registry enable row level security;

create or replace function public.sync_risk_model_registry_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sync_risk_model_registry_updated_at on public.risk_model_registry;
create trigger sync_risk_model_registry_updated_at
  before insert or update on public.risk_model_registry
  for each row
  execute function public.sync_risk_model_registry_updated_at();

drop policy if exists "Admins can read risk model registry" on public.risk_model_registry;
create policy "Admins can read risk model registry"
  on public.risk_model_registry for select
  to authenticated
  using (
    public.is_admin()
    and private.same_institution(institution_id)
  );

drop policy if exists "Admins can insert risk model registry" on public.risk_model_registry;
create policy "Admins can insert risk model registry"
  on public.risk_model_registry for insert
  to authenticated
  with check (
    public.is_admin()
    and private.same_institution(institution_id)
  );

drop policy if exists "Admins can update risk model registry" on public.risk_model_registry;
create policy "Admins can update risk model registry"
  on public.risk_model_registry for update
  to authenticated
  using (
    public.is_admin()
    and private.same_institution(institution_id)
  )
  with check (
    public.is_admin()
    and private.same_institution(institution_id)
  );
