-- Students should only see and submit to published assignments that explicitly
-- target their stored cohort. Untargeted assignments remain hidden to students.

drop policy if exists "Students can view published assignments" on public.assignments;

create policy "Students can view targeted published assignments"
on public.assignments
for select
to authenticated
using (
  status = 'published'
  and is_student()
  and exists (
    select 1
    from public.assignment_cohorts ac
    join public.profiles p
      on p.id = auth.uid()
    where ac.assignment_id = public.assignments.id
      and ac.cohort_id::text = p.cohort_id
  )
);

drop policy if exists "Students can submit to published assignments" on public.submissions;

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
    join public.assignment_cohorts ac
      on ac.assignment_id = a.id
    join public.profiles p
      on p.id = auth.uid()
    where a.id::text = submissions.assignment_id::text
      and a.status = 'published'
      and ac.cohort_id::text = p.cohort_id
  )
);
