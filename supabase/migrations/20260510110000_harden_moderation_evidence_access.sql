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
        and (
          s.student_id = (select auth.uid())
          or s.uploaded_by = (select auth.uid())
          or exists (
            select 1
            from public.assignments a
            where a.id::text = s.assignment_id
              and a.lecturer_id = (select auth.uid())
          )
          or exists (
            select 1
            from public.moderation_cases mc
            where mc.submission_id = s.id
              and mc.moderator_id = (select auth.uid())
          )
        )
    )
  )
);

drop policy if exists "Assigned moderators can view linked integrity reviews" on public.academic_integrity_reviews;

create policy "Assigned moderators can view linked integrity reviews"
on public.academic_integrity_reviews
for select
to authenticated
using (
  private.is_admin()
  or exists (
    select 1
    from public.moderation_cases mc
    where mc.submission_id = public.academic_integrity_reviews.submission_id
      and mc.moderator_id = (select auth.uid())
  )
);
