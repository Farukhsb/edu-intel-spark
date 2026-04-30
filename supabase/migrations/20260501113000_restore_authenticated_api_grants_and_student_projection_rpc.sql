grant usage on schema public to authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;

grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert, update, delete on public.assignment_cohorts to authenticated;
grant select, insert, update, delete on public.assignment_departments to authenticated;

grant select, insert, update on public.submissions to authenticated;
grant select, insert, update on public.grades to authenticated;

grant select, insert, update on public.communication_messages to authenticated;

grant select, insert, update on public.moderation_cases to authenticated;
grant select, insert on public.moderation_reviews to authenticated;
grant select, insert on public.grade_audit_log to authenticated;

grant select, insert, update on public.academic_integrity_reviews to authenticated;
grant select, insert, update, delete on public.student_interventions to authenticated;

grant select, insert, update on public.analytics_recommendations to authenticated;
grant select, insert on public.recommendation_actions to authenticated;

grant select, insert, update on public.improvement_plan_progress to authenticated;
grant select on public.student_writing_profiles to authenticated;
grant select on public.admin_audit_log to authenticated;

create or replace function public.get_student_submission_grade_projection()
returns table (
  submission_id uuid,
  assignment_id uuid,
  assignment_title text,
  module_code text,
  max_score integer,
  file_name text,
  file_url text,
  submission_status public.submission_status,
  submitted_at timestamptz,
  final_score double precision,
  ai_score double precision,
  final_feedback text,
  ai_feedback text,
  ai_breakdown jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id as submission_id,
    a.id as assignment_id,
    a.title as assignment_title,
    a.module_code,
    a.max_score,
    s.file_name,
    s.file_url,
    s.status as submission_status,
    s.submitted_at,
    g.final_score,
    g.ai_score,
    g.final_feedback,
    g.ai_feedback,
    g.ai_breakdown::jsonb
  from public.submissions s
  join public.assignments a
    on a.id::text = s.assignment_id::text
  left join public.grades g
    on g.submission_id = s.id
  where s.student_id = auth.uid()
  order by s.submitted_at desc
$$;

revoke all on function public.get_student_submission_grade_projection() from public;
grant execute on function public.get_student_submission_grade_projection() to authenticated;

revoke all on function public.get_student_grade_assignment_metadata() from public;
grant execute on function public.get_student_grade_assignment_metadata() to authenticated;

revoke all on function public.apply_recommendation_action(text, text, jsonb) from public;
grant execute on function public.apply_recommendation_action(text, text, jsonb) to authenticated;
