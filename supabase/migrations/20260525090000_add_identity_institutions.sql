create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.institutions enable row level security;

create index if not exists institutions_status_idx
  on public.institutions (status);

drop trigger if exists update_institutions_updated_at on public.institutions;
create trigger update_institutions_updated_at
before update on public.institutions
for each row
execute function public.update_updated_at_column();

insert into public.institutions (name, slug, status)
values ('Default Institution', 'default', 'active')
on conflict (slug) do nothing;

alter table public.profiles
add column if not exists institution_id uuid;

alter table public.user_roles
add column if not exists institution_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_institution_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_institution_id_fkey
      foreign key (institution_id)
      references public.institutions(id)
      on delete restrict;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_roles_institution_id_fkey'
  ) then
    alter table public.user_roles
      add constraint user_roles_institution_id_fkey
      foreign key (institution_id)
      references public.institutions(id)
      on delete restrict;
  end if;
end;
$$;

update public.profiles
set institution_id = (
  select id
  from public.institutions
  where slug = 'default'
)
where institution_id is null;

update public.user_roles ur
set institution_id = coalesce(
  ur.institution_id,
  p.institution_id,
  (
    select id
    from public.institutions
    where slug = 'default'
  )
)
from public.profiles p
where p.id = ur.user_id
  and ur.institution_id is null;

update public.user_roles
set institution_id = (
  select id
  from public.institutions
  where slug = 'default'
)
where institution_id is null;

alter table public.profiles
alter column institution_id set not null;

alter table public.user_roles
alter column institution_id set not null;

create index if not exists profiles_institution_id_idx
  on public.profiles (institution_id);

create index if not exists user_roles_institution_id_idx
  on public.user_roles (institution_id);

create index if not exists user_roles_user_institution_idx
  on public.user_roles (user_id, institution_id);

create or replace function private.user_institution_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.institution_id
  from public.profiles p
  where p.id = _user_id
$$;

create or replace function private.current_institution_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select private.user_institution_id((select auth.uid()))
$$;

create or replace function private.same_institution(_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _institution_id is not null
    and _institution_id = private.current_institution_id()
$$;

revoke all on function private.user_institution_id(uuid) from public;
revoke all on function private.current_institution_id() from public;
revoke all on function private.same_institution(uuid) from public;

grant execute on function private.user_institution_id(uuid) to authenticated;
grant execute on function private.current_institution_id() to authenticated;
grant execute on function private.same_institution(uuid) to authenticated;

create or replace function public.resolve_signup_institution_id(_raw_user_meta_data jsonb)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _requested_institution_id_text text := nullif(trim(coalesce(_raw_user_meta_data->>'institution_id', '')), '');
  _requested_institution_slug text := nullif(trim(lower(coalesce(_raw_user_meta_data->>'institution_slug', ''))), '');
  _resolved_institution_id uuid;
begin
  if _requested_institution_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select i.id
    into _resolved_institution_id
    from public.institutions i
    where i.id = _requested_institution_id_text::uuid;
  end if;

  if _resolved_institution_id is null and _requested_institution_slug is not null then
    select i.id
    into _resolved_institution_id
    from public.institutions i
    where lower(i.slug) = _requested_institution_slug;
  end if;

  if _resolved_institution_id is null then
    select i.id
    into _resolved_institution_id
    from public.institutions i
    where i.slug = 'default';
  end if;

  return _resolved_institution_id;
end;
$$;

create or replace function public.sync_user_role_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.institution_id is null then
    select p.institution_id
    into new.institution_id
    from public.profiles p
    where p.id = new.user_id;
  end if;

  if new.institution_id is null then
    select i.id
    into new.institution_id
    from public.institutions i
    where i.slug = 'default';
  end if;

  return new;
end;
$$;

drop trigger if exists sync_user_role_institution_id on public.user_roles;
create trigger sync_user_role_institution_id
before insert or update on public.user_roles
for each row
execute function public.sync_user_role_institution_id();

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
  _institution_id uuid := public.resolve_signup_institution_id(new.raw_user_meta_data);
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
    department_id,
    institution_id
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    _role,
    nullif(new.raw_user_meta_data->>'cohort_id', ''),
    _department_name,
    _department_name,
    _institution_id
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role,
    cohort_id = excluded.cohort_id,
    department_name = excluded.department_name,
    department_id = excluded.department_id,
    institution_id = coalesce(public.profiles.institution_id, excluded.institution_id);

  insert into public.user_roles (user_id, role, institution_id)
  values (new.id, _role, _institution_id)
  on conflict (user_id, role) do update
  set institution_id = coalesce(public.user_roles.institution_id, excluded.institution_id);

  return new;
end;
$$;

create or replace function public.admin_update_user_profile(
  target_user_id uuid,
  new_full_name text,
  new_role public.app_role,
  new_department_name text,
  new_cohort_id text,
  new_must_change_password boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _actor_id uuid := auth.uid();
  _actor_name text;
  _actor_is_admin boolean;
  _target_profile public.profiles%rowtype;
  _normalized_full_name text := nullif(trim(new_full_name), '');
  _normalized_department_name text := nullif(trim(new_department_name), '');
  _normalized_cohort_id text := nullif(trim(new_cohort_id), '');
  _previous_role text;
  _next_role text := new_role::text;
  _changed_fields text[] := '{}';
begin
  if _actor_id is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1
    from public.profiles actor_profile
    where actor_profile.id = _actor_id
      and actor_profile.role::text = 'admin'
  ) or exists (
    select 1
    from public.user_roles actor_role
    where actor_role.user_id = _actor_id
      and actor_role.role::text = 'admin'
  )
  into _actor_is_admin;

  if not coalesce(_actor_is_admin, false) then
    raise exception 'Only admins can update user profiles';
  end if;

  select full_name
  into _actor_name
  from public.profiles
  where id = _actor_id;

  select *
  into _target_profile
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    raise exception 'Target user was not found';
  end if;

  _previous_role := _target_profile.role::text;

  if _target_profile.full_name is distinct from _normalized_full_name then
    _changed_fields := array_append(_changed_fields, 'full_name');
  end if;

  if _previous_role is distinct from _next_role then
    _changed_fields := array_append(_changed_fields, 'role');
  end if;

  if _target_profile.department_name is distinct from _normalized_department_name then
    _changed_fields := array_append(_changed_fields, 'department_name');
  end if;

  if (
    case
      when new_role = 'student' then _normalized_cohort_id
      else null
    end
  ) is distinct from _target_profile.cohort_id then
    _changed_fields := array_append(_changed_fields, 'cohort_id');
  end if;

  if _target_profile.must_change_password is distinct from coalesce(new_must_change_password, false) then
    _changed_fields := array_append(_changed_fields, 'must_change_password');
  end if;

  update public.profiles
  set
    full_name = _normalized_full_name,
    role = new_role,
    department_name = _normalized_department_name,
    department_id = _normalized_department_name,
    cohort_id = case
      when new_role = 'student' then _normalized_cohort_id
      else null
    end,
    must_change_password = coalesce(new_must_change_password, false)
  where id = target_user_id;

  if _previous_role is distinct from _next_role then
    delete from public.user_roles
    where user_id = target_user_id;

    insert into public.user_roles (user_id, role, institution_id)
    values (target_user_id, new_role, _target_profile.institution_id);
  end if;

  insert into public.admin_audit_log (
    actor_id,
    actor_role,
    action_type,
    target_user_id,
    target_user_name,
    target_user_email,
    details
  )
  values (
    _actor_id,
    'admin',
    'admin_profile_update',
    target_user_id,
    coalesce(_normalized_full_name, _target_profile.full_name, _target_profile.email, 'Unknown user'),
    _target_profile.email,
    jsonb_build_object(
      'actor_name', coalesce(_actor_name, 'Admin'),
      'changed_fields', _changed_fields,
      'role', _next_role,
      'department_name', _normalized_department_name,
      'cohort_id', case when new_role = 'student' then _normalized_cohort_id else null end,
      'must_change_password', coalesce(new_must_change_password, false)
    )
  );
end;
$$;
