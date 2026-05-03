create or replace function public.get_admin_recent_activity()
returns table (
  id text,
  created_at timestamptz,
  title text,
  detail text,
  tone text
)
language sql
stable
security definer
set search_path = public
as $$
  with combined as (
    select
      'assignment-' || a.id::text as id,
      a.created_at,
      coalesce(p.full_name, p.email, 'Unknown lecturer') || ' created ' || a.title as title,
      case
        when a.module_code is not null then 'Assignment tracked under ' || a.module_code || '.'
        else 'New assignment record created.'
      end as detail,
      'neutral'::text as tone
    from public.assignments a
    left join public.profiles p
      on p.id = a.lecturer_id
    where private.is_admin()

    union all

    select
      'submission-' || s.id::text as id,
      s.submitted_at as created_at,
      coalesce(s.student_name, s.student_email, 'Student record unavailable') || ' submitted work' as title,
      coalesce(a.title, 'Unknown assignment') || ' is now in ' || replace(s.status::text, '_', ' ') || ' state.' as detail,
      case
        when s.status in ('moderation_pending', 'moderation_in_progress', 'escalated') then 'warning'
        else 'neutral'
      end as tone
    from public.submissions s
    left join public.assignments a
      on a.id::text = s.assignment_id
    where private.is_admin()

    union all

    select
      'moderation-' || mc.id::text as id,
      mc.updated_at as created_at,
      coalesce(a.title, 'Unknown assignment') || ' moderation is ' || replace(mc.status, '_', ' ') as title,
      case
        when mc.integrity_risk_score is not null then
          'Integrity risk ' || round(mc.integrity_risk_score)::text || '%' ||
          case
            when mc.first_marker_score is not null and mc.moderator_score is not null and abs(mc.first_marker_score - mc.moderator_score) >= 5
              then ' and marker disagreement detected.'
            else '.'
          end
        else coalesce(mc.trigger_summary, 'Moderation case updated.')
      end as detail,
      case
        when mc.status = 'escalated' or coalesce(mc.integrity_risk_score, 0) >= 70 then 'warning'
        else 'success'
      end as tone
    from public.moderation_cases mc
    left join public.assignments a
      on a.id = mc.assignment_id
    where private.is_admin()

    union all

    select
      'admin-audit-' || aal.id::text as id,
      aal.created_at,
      coalesce(aal.details->>'actor_name', 'Admin') || ' changed user role' as title,
      coalesce(aal.target_user_name, 'Unknown user') as detail,
      'success'::text as tone
    from public.admin_audit_log aal
    where private.is_admin()
      and aal.action_type = 'role_changed'

    union all

    select
      'workflow-audit-' || gal.id::text as id,
      gal.created_at,
      'Workflow ' || replace(gal.event_type, '_', ' ') as title,
      coalesce(gal.reason, 'Submission ' || gal.submission_id::text) as detail,
      'neutral'::text as tone
    from public.grade_audit_log gal
    where private.is_admin()
  )
  select
    combined.id,
    combined.created_at,
    combined.title,
    combined.detail,
    combined.tone
  from combined
  order by combined.created_at desc
  limit 10
$$;

revoke all on function public.get_admin_recent_activity() from public;
grant execute on function public.get_admin_recent_activity() to authenticated;
