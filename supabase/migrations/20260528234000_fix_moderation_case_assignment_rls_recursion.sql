drop policy if exists "Lecturers can insert moderation cases" on public.moderation_cases;
create policy "Lecturers can insert moderation cases"
on public.moderation_cases
for insert
to authenticated
with check (
  lecturer_id = (select auth.uid())
  and first_marker_id = (select auth.uid())
  and private.same_institution(institution_id)
);

drop policy if exists "Lecturers can update moderation cases" on public.moderation_cases;
create policy "Lecturers can update moderation cases"
on public.moderation_cases
for update
to authenticated
using (
  private.same_institution(institution_id)
  and (
    lecturer_id = (select auth.uid())
    or first_marker_id = (select auth.uid())
    or moderator_id = (select auth.uid())
  )
)
with check (
  private.same_institution(institution_id)
  and (
    lecturer_id = (select auth.uid())
    or first_marker_id = (select auth.uid())
    or moderator_id = (select auth.uid())
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
      and original.institution_id = public.moderation_cases.institution_id
  )
);
