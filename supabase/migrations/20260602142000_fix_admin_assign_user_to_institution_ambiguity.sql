drop function if exists public.admin_assign_user_to_institution(uuid, text);

create function public.admin_assign_user_to_institution(
  p_target_user_id uuid,
  p_target_institution_slug text
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
  _normalized_target_slug text := lower(nullif(trim(p_target_institution_slug), ''));
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
  where id = p_target_user_id
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
    where a.lecturer_id = p_target_user_id
      and a.institution_id = _target_profile.institution_id
    union all
    select 1
    from public.submissions s
    where s.student_id = p_target_user_id
      and s.institution_id = _target_profile.institution_id
    union all
    select 1
    from public.communication_messages cm
    where (
      cm.sender_id = p_target_user_id
      or cm.recipient_id = p_target_user_id
    )
      and cm.institution_id = _target_profile.institution_id
    union all
    select 1
    from public.admin_audit_log aal
    where (
      aal.actor_id = p_target_user_id
      or aal.target_user_id = p_target_user_id
    )
      and aal.institution_id = _target_profile.institution_id
  )
  into _existing_activity;

  if _existing_activity then
    raise exception 'Users with institution-linked activity cannot be reassigned automatically';
  end if;

  update public.profiles
  set institution_id = _target_institution.id
  where id = p_target_user_id;

  update public.user_roles
  set institution_id = _target_institution.id
  where user_id = p_target_user_id;

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
    p_target_user_id,
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
