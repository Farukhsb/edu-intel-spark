create or replace function public.get_admin_assignment_oversight()
returns table (
  id uuid,
  title text,
  module_code text,
  status public.assignment_status,
  due_date timestamptz,
  created_at timestamptz,
  lecturer_name text,
  submission_count bigint,
  graded_count bigint,
  released_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.title,
    a.module_code,
    a.status,
    a.due_date,
    a.created_at,
    coalesce(p.full_name, p.email, 'Unknown lecturer') as lecturer_name,
    count(s.id)::bigint as submission_count,
    count(s.id) filter (
      where s.status in (
        'ai_graded',
        'under_review',
        'approved',
        'released',
        'moderation_pending',
        'moderation_in_progress',
        'moderated',
        'escalated'
      )
    )::bigint as graded_count,
    count(s.id) filter (where s.status = 'released')::bigint as released_count
  from public.assignments a
  left join public.profiles p
    on p.id = a.lecturer_id
  left join public.submissions s
    on s.assignment_id = a.id::text
  where private.is_admin()
  group by a.id, a.title, a.module_code, a.status, a.due_date, a.created_at, p.full_name, p.email
  order by a.created_at desc
$$;

revoke all on function public.get_admin_assignment_oversight() from public;
grant execute on function public.get_admin_assignment_oversight() to authenticated;
