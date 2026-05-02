create schema if not exists private;

grant usage on schema private to authenticated;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.has_role((select auth.uid()), 'admin')
$$;

create or replace function private.is_lecturer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.has_role((select auth.uid()), 'lecturer')
$$;

create or replace function private.is_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.has_role((select auth.uid()), 'student')
$$;

create or replace function private.is_assignment_owner(_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments a
    where a.id = _assignment_id
      and a.lecturer_id = (select auth.uid())
  )
$$;

create or replace function private.student_matches_assignment_target(_assignment_id uuid, _student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = _student_id
      and (
        exists (
          select 1
          from public.assignment_cohorts ac
          where ac.assignment_id = _assignment_id
        )
        or exists (
          select 1
          from public.assignment_departments ad
          where ad.assignment_id = _assignment_id
        )
      )
      and (
        not exists (
          select 1
          from public.assignment_cohorts ac
          where ac.assignment_id = _assignment_id
        )
        or exists (
          select 1
          from public.assignment_cohorts ac
          where ac.assignment_id = _assignment_id
            and ac.cohort_id::text = p.cohort_id
        )
      )
      and (
        not exists (
          select 1
          from public.assignment_departments ad
          where ad.assignment_id = _assignment_id
        )
        or exists (
          select 1
          from public.assignment_departments ad
          where ad.assignment_id = _assignment_id
            and ad.department_id = p.department_id
        )
      )
  )
$$;

revoke all on function private.has_role(uuid, public.app_role) from public;
revoke all on function private.is_admin() from public;
revoke all on function private.is_lecturer() from public;
revoke all on function private.is_student() from public;
revoke all on function private.is_assignment_owner(uuid) from public;
revoke all on function private.student_matches_assignment_target(uuid, uuid) from public;

grant execute on function private.has_role(uuid, public.app_role) to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_lecturer() to authenticated;
grant execute on function private.is_student() to authenticated;
grant execute on function private.is_assignment_owner(uuid) to authenticated;
grant execute on function private.student_matches_assignment_target(uuid, uuid) to authenticated;

drop policy if exists "Admins can view admin audit log" on public.admin_audit_log;
create policy "Admins can view admin audit log"
on public.admin_audit_log
for select
to authenticated
using (private.is_admin());

drop policy if exists "Lecturers can manage own assignment cohorts" on public.assignment_cohorts;
create policy "Lecturers can manage own assignment cohorts"
on public.assignment_cohorts
for all
to authenticated
using (private.is_assignment_owner(assignment_id))
with check (private.is_assignment_owner(assignment_id));

drop policy if exists "Lecturers can manage own assignment departments" on public.assignment_departments;
create policy "Lecturers can manage own assignment departments"
on public.assignment_departments
for all
to authenticated
using (private.is_assignment_owner(assignment_id))
with check (private.is_assignment_owner(assignment_id));

drop policy if exists "Students can view targeted published assignments" on public.assignments;
create policy "Students can view targeted published assignments"
on public.assignments
for select
to authenticated
using (
  status = 'published'
  and private.is_student()
  and private.student_matches_assignment_target(id, (select auth.uid()))
);

drop policy if exists "Lecturers can view all progress" on public.improvement_plan_progress;
create policy "Lecturers can view all progress"
on public.improvement_plan_progress
for select
to authenticated
using (private.is_lecturer());

drop policy if exists "Lecturers can view all profiles" on public.profiles;
create policy "Lecturers can view all profiles"
on public.profiles
for select
to authenticated
using (private.is_lecturer());

drop policy if exists "Students can submit to targeted published assignments" on public.submissions;
create policy "Students can submit to targeted published assignments"
on public.submissions
for insert
to authenticated
with check (
  student_id = (select auth.uid())
  and uploaded_by = (select auth.uid())
  and exists (
    select 1
    from public.assignments a
    where a.id = public.submissions.assignment_id::uuid
      and a.status = 'published'
      and private.student_matches_assignment_target(a.id, (select auth.uid()))
  )
);

create or replace function public.log_grade_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.grade_audit_log (
      submission_id,
      grade_id,
      changed_by,
      event_type,
      actor_role,
      new_values
    )
    values (
      new.submission_id,
      new.id,
      actor_id,
      'grade_created',
      case when private.is_lecturer() then 'lecturer' else 'system' end,
      jsonb_build_object(
        'ai_score', new.ai_score,
        'lecturer_score', new.lecturer_score,
        'final_score', new.final_score,
        'grading_confidence', new.grading_confidence
      )
    );

    return new;
  end if;

  if row(
    old.ai_score,
    old.lecturer_score,
    old.final_score,
    old.ai_feedback,
    old.lecturer_feedback,
    old.final_feedback,
    old.reviewed_by,
    old.reviewed_at
  ) is distinct from row(
    new.ai_score,
    new.lecturer_score,
    new.final_score,
    new.ai_feedback,
    new.lecturer_feedback,
    new.final_feedback,
    new.reviewed_by,
    new.reviewed_at
  ) then
    insert into public.grade_audit_log (
      submission_id,
      grade_id,
      changed_by,
      event_type,
      actor_role,
      previous_values,
      new_values
    )
    values (
      new.submission_id,
      new.id,
      actor_id,
      'grade_updated',
      case when private.is_lecturer() then 'lecturer' else 'system' end,
      jsonb_build_object(
        'ai_score', old.ai_score,
        'lecturer_score', old.lecturer_score,
        'final_score', old.final_score,
        'ai_feedback', old.ai_feedback,
        'lecturer_feedback', old.lecturer_feedback,
        'final_feedback', old.final_feedback,
        'reviewed_by', old.reviewed_by,
        'reviewed_at', old.reviewed_at
      ),
      jsonb_build_object(
        'ai_score', new.ai_score,
        'lecturer_score', new.lecturer_score,
        'final_score', new.final_score,
        'ai_feedback', new.ai_feedback,
        'lecturer_feedback', new.lecturer_feedback,
        'final_feedback', new.final_feedback,
        'reviewed_by', new.reviewed_by,
        'reviewed_at', new.reviewed_at
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function public.has_role(uuid, public.app_role) from public;
revoke all on function public.has_role(uuid, public.app_role) from authenticated;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from authenticated;

revoke all on function public.is_lecturer() from public;
revoke all on function public.is_lecturer() from authenticated;

revoke all on function public.is_student() from public;
revoke all on function public.is_student() from authenticated;

revoke all on function public.is_assignment_owner(uuid) from public;
revoke all on function public.is_assignment_owner(uuid) from authenticated;

revoke all on function public.student_matches_assignment_target(uuid, uuid) from public;
revoke all on function public.student_matches_assignment_target(uuid, uuid) from authenticated;
