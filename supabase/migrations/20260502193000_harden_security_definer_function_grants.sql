create or replace function public.update_student_interventions_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    revoke all on function public.rls_auto_enable() from public;
    revoke all on function public.rls_auto_enable() from anon;
    revoke all on function public.rls_auto_enable() from authenticated;
  end if;
end;
$$;

revoke all on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.is_lecturer() from public;
grant execute on function public.is_lecturer() to authenticated;

revoke all on function public.is_student() from public;
grant execute on function public.is_student() to authenticated;

revoke all on function public.is_assignment_owner(uuid) from public;
grant execute on function public.is_assignment_owner(uuid) to authenticated;

revoke all on function public.student_matches_assignment_target(uuid, uuid) from public;
grant execute on function public.student_matches_assignment_target(uuid, uuid) to authenticated;
