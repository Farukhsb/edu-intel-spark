alter table public.grades
add column if not exists grade_source text not null default 'ai_graded',
add column if not exists source_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'grades_grade_source_check'
  ) then
    alter table public.grades
      add constraint grades_grade_source_check
      check (grade_source in ('ai_graded', 'lecturer_reviewed', 'lecturer_uploaded'));
  end if;
end;
$$;

create table if not exists public.grade_imports (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  imported_by uuid references auth.users(id) on delete set null,
  import_method text not null check (import_method in ('csv', 'image')),
  file_path text,
  rows_processed integer not null default 0 check (rows_processed >= 0),
  rows_accepted integer not null default 0 check (rows_accepted >= 0 and rows_accepted <= rows_processed),
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_grade_imports_institution_id
  on public.grade_imports (institution_id);

create index if not exists idx_grade_imports_imported_by
  on public.grade_imports (imported_by);

create index if not exists idx_grade_imports_created_at
  on public.grade_imports (created_at desc);

create index if not exists idx_grade_imports_import_method
  on public.grade_imports (import_method);

alter table public.grade_imports enable row level security;

create or replace function public.sync_grade_import_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
    private.user_institution_id(new.imported_by),
    private.default_institution_id()
  );
  return new;
end;
$$;

drop trigger if exists sync_grade_import_institution_id on public.grade_imports;
create trigger sync_grade_import_institution_id
before insert or update on public.grade_imports
for each row
execute function public.sync_grade_import_institution_id();

drop policy if exists "Users can view their own grade imports" on public.grade_imports;
create policy "Users can view their own grade imports"
  on public.grade_imports for select
  to authenticated
  using (
    imported_by = auth.uid()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "Users can insert their own grade imports" on public.grade_imports;
create policy "Users can insert their own grade imports"
  on public.grade_imports for insert
  to authenticated
  with check (
    imported_by = auth.uid()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

grant select, insert on public.grade_imports to authenticated;
grant select, insert on public.grade_imports to service_role;
