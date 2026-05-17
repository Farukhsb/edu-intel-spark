alter table if exists public.profiles
add column if not exists department_name text;

alter table if exists public.assignment_departments
add column if not exists department_name text;

update public.profiles
set department_name = coalesce(department_name, department_id)
where department_name is distinct from coalesce(department_name, department_id);

update public.assignment_departments
set department_name = coalesce(department_name, department_id)
where department_name is distinct from coalesce(department_name, department_id);

create index if not exists assignment_departments_department_name_idx
  on public.assignment_departments (department_name);

create or replace function public.sync_profile_department_columns()
returns trigger
language plpgsql
as $$
declare
  normalized_department text;
begin
  normalized_department := coalesce(nullif(new.department_name, ''), nullif(new.department_id, ''));
  new.department_name := normalized_department;
  new.department_id := normalized_department;
  return new;
end;
$$;

drop trigger if exists sync_profile_department_columns on public.profiles;
create trigger sync_profile_department_columns
before insert or update on public.profiles
for each row
execute function public.sync_profile_department_columns();

create or replace function public.sync_assignment_department_columns()
returns trigger
language plpgsql
as $$
declare
  normalized_department text;
begin
  normalized_department := coalesce(nullif(new.department_name, ''), nullif(new.department_id, ''));
  new.department_name := normalized_department;
  new.department_id := normalized_department;
  return new;
end;
$$;

drop trigger if exists sync_assignment_department_columns on public.assignment_departments;
create trigger sync_assignment_department_columns
before insert or update on public.assignment_departments
for each row
execute function public.sync_assignment_department_columns();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _requested_role text := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'student');
  _role public.app_role;
  _department_name text := coalesce(
    nullif(new.raw_user_meta_data->>'department_name', ''),
    nullif(new.raw_user_meta_data->>'department_id', '')
  );
begin
  _role := case
    when _requested_role = 'lecturer' then 'lecturer'::public.app_role
    else 'student'::public.app_role
  end;

  insert into public.profiles (
    id,
    full_name,
    email,
    role,
    cohort_id,
    department_name,
    department_id
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    _role,
    nullif(new.raw_user_meta_data->>'cohort_id', ''),
    _department_name,
    _department_name
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role,
    cohort_id = excluded.cohort_id,
    department_name = excluded.department_name,
    department_id = excluded.department_id;

  insert into public.user_roles (user_id, role)
  values (new.id, _role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;
