create or replace function public.try_parse_uuid(_value text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  if _value is null or btrim(_value) = '' then
    return null;
  end if;

  if _value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return _value::uuid;
  end if;

  return null;
end;
$$;

create or replace function public.sync_profile_department_columns()
returns trigger
language plpgsql
set search_path = public
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

create or replace function public.sync_assignment_department_columns()
returns trigger
language plpgsql
set search_path = public
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

revoke all on function public.try_parse_uuid(text) from public;
revoke all on function public.try_parse_uuid(text) from anon;
revoke all on function public.try_parse_uuid(text) from authenticated;

revoke all on function public.resolve_signup_institution_id(jsonb) from public;
revoke all on function public.resolve_signup_institution_id(jsonb) from anon;
revoke all on function public.resolve_signup_institution_id(jsonb) from authenticated;

revoke all on function public.admin_assign_user_to_institution(uuid, text) from public;
revoke all on function public.admin_create_institution(text, text) from public;
revoke all on function public.admin_update_user_profile(uuid, text, public.app_role, text, text, boolean) from public;
revoke all on function public.send_submission_to_moderation(uuid) from public;
