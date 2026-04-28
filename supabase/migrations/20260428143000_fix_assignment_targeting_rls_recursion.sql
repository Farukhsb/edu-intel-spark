create or replace function public.is_assignment_owner(_assignment_id uuid)
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
      and a.lecturer_id = auth.uid()
  )
$$;

create or replace function public.student_matches_assignment_target(_assignment_id uuid, _student_id uuid)
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
          select 1 from public.assignment_cohorts ac
          where ac.assignment_id = _assignment_id
        )
        or exists (
          select 1 from public.assignment_departments ad
          where ad.assignment_id = _assignment_id
        )
      )
      and (
        not exists (
          select 1 from public.assignment_cohorts ac
          where ac.assignment_id = _assignment_id
        )
        or exists (
          select 1 from public.assignment_cohorts ac
          where ac.assignment_id = _assignment_id
            and ac.cohort_id = p.cohort_id
        )
      )
      and (
        not exists (
          select 1 from public.assignment_departments ad
          where ad.assignment_id = _assignment_id
        )
        or exists (
          select 1 from public.assignment_departments ad
          where ad.assignment_id = _assignment_id
            and ad.department_id = p.department_id
        )
      )
  )
$$;

drop policy if exists "Lecturers can manage own assignment cohorts" on public.assignment_cohorts;

create policy "Lecturers can manage own assignment cohorts"
on public.assignment_cohorts
for all
to authenticated
using (public.is_assignment_owner(assignment_id))
with check (public.is_assignment_owner(assignment_id));

drop policy if exists "Lecturers can manage own assignment departments" on public.assignment_departments;

create policy "Lecturers can manage own assignment departments"
on public.assignment_departments
for all
to authenticated
using (public.is_assignment_owner(assignment_id))
with check (public.is_assignment_owner(assignment_id));

drop policy if exists "Students can view targeted published assignments" on public.assignments;

create policy "Students can view targeted published assignments"
on public.assignments
for select
to authenticated
using (
  status = 'published'
  and public.is_student()
  and public.student_matches_assignment_target(id, auth.uid())
);

drop policy if exists "Students can submit to targeted published assignments" on public.submissions;

create policy "Students can submit to targeted published assignments"
on public.submissions
for insert
to authenticated
with check (
  student_id = auth.uid()
  and uploaded_by = auth.uid()
  and exists (
    select 1
    from public.assignments a
    where a.id = submissions.assignment_id::uuid
      and a.status = 'published'
      and public.student_matches_assignment_target(a.id, auth.uid())
  )
);
