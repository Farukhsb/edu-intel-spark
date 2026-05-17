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
      and a.lecturer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.assignments a
    where a.id::text = public.submissions.assignment_id
      and a.lecturer_id = auth.uid()
  )
);
