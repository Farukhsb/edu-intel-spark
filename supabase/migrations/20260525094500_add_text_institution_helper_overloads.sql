create or replace function private.assignment_institution_id(_assignment_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select private.assignment_institution_id(public.try_parse_uuid(_assignment_id))
$$;

create or replace function private.submission_institution_id(_submission_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select private.submission_institution_id(public.try_parse_uuid(_submission_id))
$$;

revoke all on function private.assignment_institution_id(text) from public;
revoke all on function private.submission_institution_id(text) from public;

grant execute on function private.assignment_institution_id(text) to authenticated;
grant execute on function private.submission_institution_id(text) to authenticated;
