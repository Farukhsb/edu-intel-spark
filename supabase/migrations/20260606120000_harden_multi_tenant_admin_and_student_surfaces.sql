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
security invoker
set search_path = public
as $$
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select
    (select count(*)::bigint from public.profiles where institution_id = private.current_institution_id()),
    (select count(*)::bigint from public.profiles where role = 'lecturer' and institution_id = private.current_institution_id()),
    (select count(*)::bigint from public.profiles where role = 'student' and institution_id = private.current_institution_id()),
    (select count(*)::bigint from public.assignments where institution_id = private.current_institution_id()),
    (select count(*)::bigint from public.submissions where institution_id = private.current_institution_id()),
    (
      select count(*)::bigint
      from public.moderation_cases
      where institution_id = private.current_institution_id()
        and status in ('moderation_pending', 'moderation_in_progress', 'escalated')
    ),
    (
      select count(*)::bigint
      from public.moderation_cases
      where institution_id = private.current_institution_id()
        and (coalesce(integrity_risk_score, 0) >= 70 or status = 'escalated')
    );
end;
$$;

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
security invoker
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
   and s.institution_id = a.institution_id
  where private.is_admin()
    and a.institution_id = private.current_institution_id()
  group by a.id, a.title, a.module_code, a.status, a.due_date, a.created_at, p.full_name, p.email
  order by a.created_at desc
$$;

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
security invoker
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
   and a.institution_id = mc.institution_id
  left join public.profiles first_marker
    on first_marker.id = mc.first_marker_id
  left join public.profiles moderator
    on moderator.id = mc.moderator_id
  where private.is_admin()
    and mc.institution_id = private.current_institution_id()
  order by mc.updated_at desc
$$;

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
security invoker
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
    on a.id::text = s.assignment_id::text
   and a.institution_id = s.institution_id
  where s.student_id = auth.uid()
    and s.institution_id = private.current_institution_id()
$$;

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
security invoker
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
    case when s.status = 'released' then g.final_score else null end as final_score,
    case when s.status = 'released' then g.ai_score else null end as ai_score,
    case when s.status = 'released' then g.final_feedback else null end as final_feedback,
    case when s.status = 'released' then g.ai_feedback else null end as ai_feedback,
    case when s.status = 'released' then g.ai_breakdown::jsonb else null end as ai_breakdown
  from public.submissions s
  join public.assignments a
    on a.id::text = s.assignment_id::text
   and a.institution_id = s.institution_id
  left join public.grades g
    on g.submission_id = s.id
   and g.institution_id = s.institution_id
  where s.student_id = auth.uid()
    and s.institution_id = private.current_institution_id()
  order by s.submitted_at desc
$$;

create or replace function public.send_submission_to_moderation(_submission_id uuid)
returns public.moderation_cases
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission public.submissions%rowtype;
  v_assignment public.assignments%rowtype;
  v_grade public.grades%rowtype;
  v_case public.moderation_cases%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_submission
  from public.submissions
  where id = _submission_id
    and institution_id = private.current_institution_id();

  if not found then
    raise exception 'Submission not found';
  end if;

  select *
  into v_assignment
  from public.assignments
  where id::text = v_submission.assignment_id
    and institution_id = v_submission.institution_id;

  if not found then
    raise exception 'Assignment not found';
  end if;

  if v_assignment.lecturer_id <> v_user_id then
    raise exception 'Only the assignment owner can send a submission to moderation';
  end if;

  if not private.same_institution(v_assignment.institution_id) then
    raise exception 'Institution mismatch';
  end if;

  select *
  into v_grade
  from public.grades
  where submission_id = _submission_id
    and institution_id = v_submission.institution_id
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'Grade not found';
  end if;

  if v_grade.lecturer_score is null then
    raise exception 'Save a lecturer score before sending to moderation';
  end if;

  insert into public.moderation_cases (
    submission_id,
    assignment_id,
    grade_id,
    lecturer_id,
    first_marker_id,
    moderator_id,
    status,
    trigger_flags,
    trigger_summary,
    confidence_score,
    integrity_risk_score,
    ai_score_snapshot,
    first_marker_score,
    moderator_score,
    final_agreed_score,
    final_agreed_feedback,
    moderated_at,
    approved_at
  ) values (
    _submission_id,
    v_assignment.id,
    v_grade.id,
    v_user_id,
    v_user_id,
    null,
    'moderation_pending',
    array[]::text[],
    'Lecturer requested moderation handoff.',
    v_grade.grading_confidence,
    null,
    v_grade.ai_score,
    v_grade.lecturer_score,
    null,
    null,
    null,
    null,
    null
  )
  on conflict (submission_id) do update set
    assignment_id = excluded.assignment_id,
    grade_id = excluded.grade_id,
    lecturer_id = excluded.lecturer_id,
    first_marker_id = excluded.first_marker_id,
    status = excluded.status,
    trigger_flags = excluded.trigger_flags,
    trigger_summary = excluded.trigger_summary,
    confidence_score = excluded.confidence_score,
    integrity_risk_score = excluded.integrity_risk_score,
    ai_score_snapshot = excluded.ai_score_snapshot,
    first_marker_score = excluded.first_marker_score,
    moderator_id = coalesce(moderation_cases.moderator_id, excluded.moderator_id),
    moderator_score = coalesce(moderation_cases.moderator_score, excluded.moderator_score),
    final_agreed_score = coalesce(moderation_cases.final_agreed_score, excluded.final_agreed_score),
    final_agreed_feedback = coalesce(moderation_cases.final_agreed_feedback, excluded.final_agreed_feedback),
    moderated_at = moderation_cases.moderated_at,
    approved_at = moderation_cases.approved_at
  returning * into v_case;

  update public.submissions
  set status = 'moderation_pending'
  where id = _submission_id
    and institution_id = v_submission.institution_id;

  return v_case;
end;
$$;

drop policy if exists "Users can view authorized submission files" on storage.objects;

create policy "Users can view authorized submission files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'submissions'
  and (
    private.is_admin()
    or exists (
      select 1
      from public.submissions s
      where s.file_url = storage.objects.name
        and private.same_institution(s.institution_id)
        and (
          s.student_id = (select auth.uid())
          or s.uploaded_by = (select auth.uid())
          or exists (
            select 1
            from public.assignments a
            where a.id::text = s.assignment_id
              and a.lecturer_id = (select auth.uid())
              and a.institution_id = s.institution_id
          )
          or exists (
            select 1
            from public.moderation_cases mc
            where mc.submission_id = s.id
              and mc.moderator_id = (select auth.uid())
              and mc.institution_id = s.institution_id
          )
        )
    )
  )
);
