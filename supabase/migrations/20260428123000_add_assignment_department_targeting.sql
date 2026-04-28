create table if not exists public.assignment_departments (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  department_id text not null,
  created_at timestamptz not null default now(),
  primary key (assignment_id, department_id)
);

create index if not exists assignment_departments_department_id_idx
  on public.assignment_departments (department_id);

alter table public.assignment_departments enable row level security;

drop policy if exists "Lecturers can manage own assignment departments" on public.assignment_departments;

create policy "Lecturers can manage own assignment departments"
on public.assignment_departments
for all
to authenticated
using (
  exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and a.lecturer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and a.lecturer_id = auth.uid()
  )
);

drop policy if exists "Students can view targeted published assignments" on public.assignments;

create policy "Students can view targeted published assignments"
on public.assignments
for select
to authenticated
using (
  status = 'published'
  and is_student()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        exists (
          select 1 from public.assignment_cohorts ac
          where ac.assignment_id = public.assignments.id
        )
        or exists (
          select 1 from public.assignment_departments ad
          where ad.assignment_id = public.assignments.id
        )
      )
      and (
        not exists (
          select 1 from public.assignment_cohorts ac
          where ac.assignment_id = public.assignments.id
        )
        or exists (
          select 1 from public.assignment_cohorts ac
          where ac.assignment_id = public.assignments.id
            and ac.cohort_id = p.cohort_id
        )
      )
      and (
        not exists (
          select 1 from public.assignment_departments ad
          where ad.assignment_id = public.assignments.id
        )
        or exists (
          select 1 from public.assignment_departments ad
          where ad.assignment_id = public.assignments.id
            and ad.department_id = p.department_id
        )
      )
  )
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
    join public.profiles p
      on p.id = auth.uid()
    where a.id::text = submissions.assignment_id
      and a.status = 'published'
      and (
        exists (
          select 1 from public.assignment_cohorts ac
          where ac.assignment_id = a.id
        )
        or exists (
          select 1 from public.assignment_departments ad
          where ad.assignment_id = a.id
        )
      )
      and (
        not exists (
          select 1 from public.assignment_cohorts ac
          where ac.assignment_id = a.id
        )
        or exists (
          select 1 from public.assignment_cohorts ac
          where ac.assignment_id = a.id
            and ac.cohort_id = p.cohort_id
        )
      )
      and (
        not exists (
          select 1 from public.assignment_departments ad
          where ad.assignment_id = a.id
        )
        or exists (
          select 1 from public.assignment_departments ad
          where ad.assignment_id = a.id
            and ad.department_id = p.department_id
        )
      )
  )
);
