drop policy if exists "Students can view own grades" on public.grades;
create policy "Students can view own grades"
on public.grades
for select
to authenticated
using (
  exists (
    select 1
    from public.submissions s
    where s.id = grades.submission_id
      and s.student_id = (select auth.uid())
      and s.status = 'released'
  )
);

drop policy if exists "Lecturers can update submissions for own assignments" on public.submissions;
create policy "Lecturers can update submissions for own assignments"
on public.submissions
for update
to authenticated
using (
  exists (
    select 1
    from public.assignments a
    where a.id::text = public.submissions.assignment_id
      and a.lecturer_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.assignments a
    where a.id::text = public.submissions.assignment_id
      and a.lecturer_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.submissions original
    where original.id = public.submissions.id
      and original.assignment_id = public.submissions.assignment_id
      and coalesce(original.student_id, '00000000-0000-0000-0000-000000000000'::uuid) =
        coalesce(public.submissions.student_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and coalesce(original.student_name, '') = coalesce(public.submissions.student_name, '')
      and coalesce(original.student_email, '') = coalesce(public.submissions.student_email, '')
      and coalesce(original.file_url, '') = coalesce(public.submissions.file_url, '')
      and coalesce(original.file_name, '') = coalesce(public.submissions.file_name, '')
      and coalesce(original.file_type, '') = coalesce(public.submissions.file_type, '')
      and coalesce(original.uploaded_by, '00000000-0000-0000-0000-000000000000'::uuid) =
        coalesce(public.submissions.uploaded_by, '00000000-0000-0000-0000-000000000000'::uuid)
      and original.submitted_at = public.submissions.submitted_at
  )
);

drop policy if exists "Lecturers can insert grade audit log" on public.grade_audit_log;
create policy "Lecturers can insert grade audit log"
on public.grade_audit_log
for insert
to authenticated
with check (
  changed_by = (select auth.uid())
  and (
    exists (
      select 1
      from public.submissions s
      join public.assignments a
        on a.id::text = s.assignment_id
      where s.id = public.grade_audit_log.submission_id
        and a.lecturer_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.moderation_cases mc
      where mc.id = public.grade_audit_log.moderation_case_id
        and (
          mc.moderator_id = (select auth.uid())
          or mc.lecturer_id = (select auth.uid())
        )
    )
  )
);

drop policy if exists "Lecturers can insert moderation cases" on public.moderation_cases;
create policy "Lecturers can insert moderation cases"
on public.moderation_cases
for insert
to authenticated
with check (
  lecturer_id = (select auth.uid())
  and first_marker_id = (select auth.uid())
  and exists (
    select 1
    from public.assignments a
    where a.id = public.moderation_cases.assignment_id
      and a.lecturer_id = (select auth.uid())
  )
);

drop policy if exists "Lecturers can update moderation cases" on public.moderation_cases;
create policy "Lecturers can update moderation cases"
on public.moderation_cases
for update
to authenticated
using (
  lecturer_id = (select auth.uid())
  or first_marker_id = (select auth.uid())
  or moderator_id = (select auth.uid())
  or exists (
    select 1
    from public.assignments a
    where a.id = public.moderation_cases.assignment_id
      and a.lecturer_id = (select auth.uid())
  )
)
with check (
  (
    lecturer_id = (select auth.uid())
    or first_marker_id = (select auth.uid())
    or moderator_id = (select auth.uid())
    or exists (
      select 1
      from public.assignments a
      where a.id = public.moderation_cases.assignment_id
        and a.lecturer_id = (select auth.uid())
    )
  )
  and exists (
    select 1
    from public.moderation_cases original
    where original.id = public.moderation_cases.id
      and original.assignment_id = public.moderation_cases.assignment_id
      and original.submission_id = public.moderation_cases.submission_id
      and original.grade_id = public.moderation_cases.grade_id
      and original.lecturer_id = public.moderation_cases.lecturer_id
      and original.first_marker_id = public.moderation_cases.first_marker_id
  )
);

drop policy if exists "Lecturers can view all profiles" on public.profiles;

create policy "Lecturers can view lecturer directory"
on public.profiles
for select
to authenticated
using (
  private.is_lecturer()
  and role = 'lecturer'
);

create policy "Lecturers can view linked student profiles"
on public.profiles
for select
to authenticated
using (
  private.is_lecturer()
  and role = 'student'
  and (
    exists (
      select 1
      from public.submissions s
      join public.assignments a
        on a.id::text = s.assignment_id
      where s.student_id = public.profiles.id
        and a.lecturer_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.assignments a
      where a.lecturer_id = (select auth.uid())
        and (
          (
            exists (
              select 1
              from public.assignment_cohorts ac
              where ac.assignment_id = a.id
            )
            and exists (
              select 1
              from public.assignment_cohorts ac
              where ac.assignment_id = a.id
                and ac.cohort_id::text = public.profiles.cohort_id
            )
          )
          or (
            exists (
              select 1
              from public.assignment_departments ad
              where ad.assignment_id = a.id
            )
            and exists (
              select 1
              from public.assignment_departments ad
              where ad.assignment_id = a.id
                and ad.department_id = public.profiles.department_id
            )
          )
        )
    )
  )
);

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
    case when s.status = 'released' then g.final_score else null end as final_score,
    case when s.status = 'released' then g.ai_score else null end as ai_score,
    case when s.status = 'released' then g.final_feedback else null end as final_feedback,
    case when s.status = 'released' then g.ai_feedback else null end as ai_feedback,
    case when s.status = 'released' then g.ai_breakdown::jsonb else null end as ai_breakdown
  from public.submissions s
  join public.assignments a
    on a.id::text = s.assignment_id::text
  left join public.grades g
    on g.submission_id = s.id
  where s.student_id = auth.uid()
  order by s.submitted_at desc
$$;
