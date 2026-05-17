create or replace function public.get_admin_dashboard_metrics()
returns table (
  total_users bigint,
  active_lecturers bigint,
  active_students bigint,
  total_assignments bigint,
  total_submissions bigint,
  pending_moderation_cases bigint,
  high_integrity_risk_cases bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select
    (select count(*)::bigint from public.profiles),
    (select count(*)::bigint from public.profiles where role = 'lecturer'),
    (select count(*)::bigint from public.profiles where role = 'student'),
    (select count(*)::bigint from public.assignments),
    (select count(*)::bigint from public.submissions),
    (
      select count(*)::bigint
      from public.moderation_cases
      where status in ('moderation_pending', 'moderation_in_progress', 'escalated')
    ),
    (
      select count(*)::bigint
      from public.moderation_cases
      where coalesce(integrity_risk_score, 0) >= 70
        or status = 'escalated'
    );
end;
$$;

revoke all on function public.get_admin_dashboard_metrics() from public;
grant execute on function public.get_admin_dashboard_metrics() to authenticated;
