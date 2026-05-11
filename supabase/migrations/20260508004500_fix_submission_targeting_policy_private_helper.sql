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
      and (a.due_date is null or a.due_date > now())
      and private.student_matches_assignment_target(a.id, auth.uid())
  )
);
