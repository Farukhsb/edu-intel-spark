create or replace function private.current_institution_slug()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select i.slug
  from public.institutions i
  where i.id = private.current_institution_id()
  limit 1
$$;

revoke all on function private.current_institution_slug() from public;
grant execute on function private.current_institution_slug() to authenticated;

create or replace function public.admin_create_institution(
  new_name text,
  new_slug text
)
returns public.institutions
language plpgsql
security definer
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
