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
