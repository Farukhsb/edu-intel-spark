drop policy if exists "Admins can select institutions for provisioning" on public.institutions;
create policy "Admins can select institutions for provisioning"
on public.institutions
for select
to authenticated
using (
  private.is_admin()
  and private.current_institution_slug() = 'default'
);

drop policy if exists "Admins can create institutions" on public.institutions;
create policy "Admins can create institutions"
on public.institutions
for insert
to authenticated
with check (
  private.is_admin()
  and private.current_institution_slug() = 'default'
  and status = 'active'
);

drop policy if exists "Admins can update managed profiles" on public.profiles;
create policy "Admins can update managed profiles"
on public.profiles
for update
to authenticated
using (
  private.is_admin()
  and private.same_institution(institution_id)
  and id <> (select auth.uid())
)
with check (
  private.is_admin()
  and private.same_institution(institution_id)
  and id <> (select auth.uid())
);

drop policy if exists "Admins can manage user roles" on public.user_roles;
create policy "Admins can manage user roles"
on public.user_roles
for all
to authenticated
using (
  private.is_admin()
  and private.same_institution(institution_id)
  and user_id <> (select auth.uid())
)
with check (
  private.is_admin()
  and private.same_institution(institution_id)
  and user_id <> (select auth.uid())
);

drop policy if exists "Admins can insert admin audit log" on public.admin_audit_log;
create policy "Admins can insert admin audit log"
on public.admin_audit_log
for insert
to authenticated
with check (
  private.is_admin()
  and private.same_institution(institution_id)
  and actor_id = (select auth.uid())
  and actor_role = 'admin'
);

create or replace function public.admin_assign_user_to_institution(
  target_user_id uuid,
  target_institution_slug text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  _actor_id uuid := auth.uid();
  _actor_name text;
  _current_slug text;
  _normalized_target_slug text := lower(nullif(trim(target_institution_slug), ''));
  _target_profile public.profiles%rowtype;
  _target_institution public.institutions%rowtype;
  _existing_activity boolean;
begin
  if _actor_id is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_admin() then
    raise exception 'Only admins can assign users to institutions';
  end if;

  _current_slug := private.current_institution_slug();

  if _current_slug is distinct from 'default' then
    raise exception 'Only default institution admins can reassign users across institutions';
  end if;

  if _normalized_target_slug is null then
    raise exception 'Target institution slug is required';
  end if;

  select *
  into _target_profile
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    raise exception 'Target user was not found';
  end if;

  select *
  into _target_institution
  from public.institutions
  where slug = _normalized_target_slug
  limit 1;

  if not found then
    raise exception 'Target institution was not found';
  end if;

  if _target_profile.institution_id = _target_institution.id then
    return;
  end if;

  select exists (
    select 1
    from public.assignments a
    where a.lecturer_id = target_user_id
      and a.institution_id = _target_profile.institution_id
    union all
    select 1
    from public.submissions s
    where s.student_id = target_user_id
      and s.institution_id = _target_profile.institution_id
    union all
    select 1
    from public.communication_messages cm
    where (
      cm.sender_id = target_user_id
      or cm.recipient_id = target_user_id
    )
      and cm.institution_id = _target_profile.institution_id
    union all
    select 1
    from public.admin_audit_log aal
    where (
      aal.actor_id = target_user_id
      or aal.target_user_id = target_user_id
    )
      and aal.institution_id = _target_profile.institution_id
  )
  into _existing_activity;

  if _existing_activity then
    raise exception 'Users with institution-linked activity cannot be reassigned automatically';
  end if;

  update public.profiles
  set institution_id = _target_institution.id
  where id = target_user_id;

  update public.user_roles
  set institution_id = _target_institution.id
  where user_id = target_user_id;

  select full_name
  into _actor_name
  from public.profiles
  where id = _actor_id;

  insert into public.admin_audit_log (
    actor_id,
    actor_role,
    action_type,
    target_user_id,
    target_user_name,
    target_user_email,
    details,
    institution_id
  )
  values (
    _actor_id,
    'admin',
    'user_reassigned_institution',
    target_user_id,
    coalesce(_target_profile.full_name, _target_profile.email, 'Unknown user'),
    _target_profile.email,
    jsonb_build_object(
      'actor_name', coalesce(_actor_name, 'Admin'),
      'previous_institution_id', _target_profile.institution_id,
      'target_institution_id', _target_institution.id,
      'target_institution_slug', _target_institution.slug
    ),
    private.current_institution_id()
  );
end;
$$;

grant execute on function public.admin_assign_user_to_institution(uuid, text) to authenticated;

create or replace function public.admin_create_institution(
  new_name text,
  new_slug text
)
returns public.institutions
language plpgsql
security invoker
set search_path = public
as $$
declare
  _actor_id uuid := auth.uid();
  _actor_name text;
  _current_slug text;
  _normalized_name text := nullif(trim(new_name), '');
  _normalized_slug text := lower(nullif(trim(new_slug), ''));
  _created public.institutions%rowtype;
begin
  if _actor_id is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_admin() then
    raise exception 'Only admins can create institutions';
  end if;

  _current_slug := private.current_institution_slug();

  if _current_slug is distinct from 'default' then
    raise exception 'Only default institution admins can provision new institutions';
  end if;

  if _normalized_name is null then
    raise exception 'Institution name is required';
  end if;

  if _normalized_slug is null then
    raise exception 'Institution slug is required';
  end if;

  if _normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Institution slug must use lowercase letters, numbers, and hyphens only';
  end if;

  select full_name
  into _actor_name
  from public.profiles
  where id = _actor_id;

  insert into public.institutions (name, slug, status)
  values (_normalized_name, _normalized_slug, 'active')
  returning *
  into _created;

  insert into public.admin_audit_log (
    actor_id,
    actor_role,
    action_type,
    target_user_id,
    target_user_name,
    target_user_email,
    details,
    institution_id
  )
  values (
    _actor_id,
    'admin',
    'institution_created',
    null,
    _created.name,
    null,
    jsonb_build_object(
      'actor_name', coalesce(_actor_name, 'Admin'),
      'institution_slug', _created.slug,
      'institution_status', _created.status
    ),
    private.current_institution_id()
  );

  return _created;
end;
$$;

grant execute on function public.admin_create_institution(text, text) to authenticated;

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
security invoker
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

    insert into public.user_roles (user_id, role)
    values (target_user_id, new_role);
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

grant execute on function public.admin_update_user_profile(
  uuid,
  text,
  public.app_role,
  text,
  text,
  boolean
) to authenticated;
