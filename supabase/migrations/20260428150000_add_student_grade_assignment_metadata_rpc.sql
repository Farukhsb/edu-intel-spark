create or replace function public.get_student_grade_assignment_metadata()
returns table (
  submission_id uuid,
  assignment_id uuid,
  title text,
  module_code text,
  max_score integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id as submission_id,
    a.id as assignment_id,
    a.title,
    a.module_code,
    a.max_score
  from public.submissions s
  join public.assignments a
    on a.id::text = s.assignment_id
  where s.student_id = auth.uid()
$$;

revoke all on function public.get_student_grade_assignment_metadata() from public;
grant execute on function public.get_student_grade_assignment_metadata() to authenticated;
