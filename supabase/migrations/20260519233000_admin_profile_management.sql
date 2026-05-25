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
