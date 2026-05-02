-- Consolidate duplicated permissive RLS policies and use initplan-friendly
-- auth helpers on the highest-noise tables.

-- Profiles
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()));

-- User roles
drop policy if exists "Users can view own roles" on public.user_roles;
create policy "Users can view own roles"
on public.user_roles
for select
to authenticated
using (user_id = (select auth.uid()));

-- Student interventions
drop policy if exists "Lecturers can view own interventions" on public.student_interventions;
drop policy if exists "Lecturers can view their own interventions" on public.student_interventions;
drop policy if exists "Lecturers can insert own interventions" on public.student_interventions;
drop policy if exists "Lecturers can create their own interventions" on public.student_interventions;
drop policy if exists "Lecturers can update own interventions" on public.student_interventions;
drop policy if exists "Lecturers can update their own interventions" on public.student_interventions;
drop policy if exists "Lecturers can delete own interventions" on public.student_interventions;
drop policy if exists "Lecturers can delete their own interventions" on public.student_interventions;

create policy "Lecturers can manage own interventions"
on public.student_interventions
for all
to authenticated
using (
  lecturer_id = (select auth.uid())
  and (
    assignment_id is null
    or exists (
      select 1
      from public.assignments a
      where a.id = assignment_id
        and a.lecturer_id = (select auth.uid())
    )
  )
  and (
    student_id is null
    or exists (
      select 1
      from public.submissions s
      join public.assignments a
        on a.id::text = s.assignment_id
      where s.student_id = student_interventions.student_id
        and a.lecturer_id = (select auth.uid())
    )
  )
)
with check (
  lecturer_id = (select auth.uid())
  and (
    assignment_id is null
    or exists (
      select 1
      from public.assignments a
      where a.id = assignment_id
        and a.lecturer_id = (select auth.uid())
    )
  )
  and (
    student_id is null
    or exists (
      select 1
      from public.submissions s
      join public.assignments a
        on a.id::text = s.assignment_id
      where s.student_id = student_interventions.student_id
        and a.lecturer_id = (select auth.uid())
    )
  )
);

-- Submissions
drop policy if exists "Students can insert own submissions" on public.submissions;
drop policy if exists "Students can submit to published assignments" on public.submissions;
drop policy if exists "Students can submit to targeted published assignments" on public.submissions;
drop policy if exists "Students can view own submissions" on public.submissions;
drop policy if exists "Lecturers can view submissions for their assignments" on public.submissions;
drop policy if exists "Lecturers can view submissions for own assignments" on public.submissions;
drop policy if exists "Lecturers can update submissions for their assignments" on public.submissions;
drop policy if exists "Lecturers can update submissions for own assignments" on public.submissions;
drop policy if exists "Lecturers can upload submissions for own assignments" on public.submissions;
drop policy if exists "Lecturers can insert submissions for their assignments" on public.submissions;

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
    where a.id = submissions.assignment_id::uuid
      and a.status = 'published'
      and public.student_matches_assignment_target(a.id, (select auth.uid()))
  )
);

create policy "Students can view own submissions"
on public.submissions
for select
to authenticated
using (student_id = (select auth.uid()));

create policy "Lecturers can view submissions for own assignments"
on public.submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.assignments a
    where a.id::text = submissions.assignment_id
      and a.lecturer_id = (select auth.uid())
  )
);

create policy "Lecturers can upload submissions for own assignments"
on public.submissions
for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1
    from public.assignments a
    where a.id::text = submissions.assignment_id
      and a.lecturer_id = (select auth.uid())
  )
);

create policy "Lecturers can update submissions for own assignments"
on public.submissions
for update
to authenticated
using (
  exists (
    select 1
    from public.assignments a
    where a.id::text = submissions.assignment_id
      and a.lecturer_id = (select auth.uid())
  )
)
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1
    from public.assignments a
    where a.id::text = submissions.assignment_id
      and a.lecturer_id = (select auth.uid())
  )
);

-- Grades
drop policy if exists "Students can view own grades" on public.grades;
drop policy if exists "Lecturers can manage grades for their assignments" on public.grades;
drop policy if exists "Lecturers can manage grades for own assignments" on public.grades;

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
  )
);

create policy "Lecturers can manage grades for own assignments"
on public.grades
for all
to authenticated
using (
  exists (
    select 1
    from public.submissions s
    join public.assignments a
      on a.id::text = s.assignment_id
    where s.id = grades.submission_id
      and a.lecturer_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.submissions s
    join public.assignments a
      on a.id::text = s.assignment_id
    where s.id = grades.submission_id
      and a.lecturer_id = (select auth.uid())
  )
);
