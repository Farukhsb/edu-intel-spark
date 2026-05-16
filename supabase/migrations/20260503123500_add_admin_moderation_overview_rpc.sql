create or replace function public.get_admin_moderation_overview()
returns table (
  id uuid,
  assignment_title text,
  first_marker_name text,
  moderator_name text,
  status text,
  integrity_risk_score numeric,
  confidence_score numeric,
  created_at timestamptz,
  updated_at timestamptz,
  trigger_summary text,
  disagreement boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    mc.id,
    coalesce(a.title, 'Unknown assignment') as assignment_title,
    coalesce(first_marker.full_name, first_marker.email, 'Unassigned') as first_marker_name,
    coalesce(moderator.full_name, moderator.email, 'Unassigned') as moderator_name,
    mc.status,
    mc.integrity_risk_score,
    mc.confidence_score,
    mc.created_at,
    mc.updated_at,
    mc.trigger_summary,
    (
      mc.first_marker_score is not null
      and mc.moderator_score is not null
      and abs(mc.first_marker_score - mc.moderator_score) >= 5
    ) as disagreement
  from public.moderation_cases mc
  left join public.assignments a
    on a.id = mc.assignment_id
  left join public.profiles first_marker
    on first_marker.id = mc.first_marker_id
  left join public.profiles moderator
    on moderator.id = mc.moderator_id
  where private.is_admin()
  order by mc.updated_at desc
$$;

revoke all on function public.get_admin_moderation_overview() from public;
grant execute on function public.get_admin_moderation_overview() to authenticated;
