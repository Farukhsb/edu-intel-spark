-- Final initplan tuning pass for remaining noisy moderation/integrity policies.

-- Academic integrity reviews
drop policy if exists "Lecturers can view own reviews" on public.academic_integrity_reviews;
create policy "Lecturers can view own reviews"
on public.academic_integrity_reviews
for select
to authenticated
using (
  lecturer_id = (select auth.uid())
  and exists (
    select 1
    from public.submissions s
    join public.assignments a
      on a.id::text = s.assignment_id
    where s.id = public.academic_integrity_reviews.submission_id
      and a.lecturer_id = (select auth.uid())
  )
);

drop policy if exists "Lecturers can insert own reviews" on public.academic_integrity_reviews;
create policy "Lecturers can insert own reviews"
on public.academic_integrity_reviews
for insert
to authenticated
with check (
  lecturer_id = (select auth.uid())
  and exists (
    select 1
    from public.submissions s
    join public.assignments a
      on a.id::text = s.assignment_id
    where s.id = public.academic_integrity_reviews.submission_id
      and a.lecturer_id = (select auth.uid())
  )
);

drop policy if exists "Lecturers can update own reviews" on public.academic_integrity_reviews;
create policy "Lecturers can update own reviews"
on public.academic_integrity_reviews
for update
to authenticated
using (
  lecturer_id = (select auth.uid())
  and exists (
    select 1
    from public.submissions s
    join public.assignments a
      on a.id::text = s.assignment_id
    where s.id = public.academic_integrity_reviews.submission_id
      and a.lecturer_id = (select auth.uid())
  )
)
with check (
  lecturer_id = (select auth.uid())
  and exists (
    select 1
    from public.submissions s
    join public.assignments a
      on a.id::text = s.assignment_id
    where s.id = public.academic_integrity_reviews.submission_id
      and a.lecturer_id = (select auth.uid())
  )
);

drop policy if exists "Lecturers can delete own reviews" on public.academic_integrity_reviews;
create policy "Lecturers can delete own reviews"
on public.academic_integrity_reviews
for delete
to authenticated
using (
  lecturer_id = (select auth.uid())
  and exists (
    select 1
    from public.submissions s
    join public.assignments a
      on a.id::text = s.assignment_id
    where s.id = public.academic_integrity_reviews.submission_id
      and a.lecturer_id = (select auth.uid())
  )
);

-- Moderation reviews
drop policy if exists "Lecturers can view moderation reviews" on public.moderation_reviews;
create policy "Lecturers can view moderation reviews"
on public.moderation_reviews
for select
to authenticated
using (
  reviewer_id = (select auth.uid())
  or exists (
    select 1
    from public.moderation_cases mc
    where mc.id = public.moderation_reviews.moderation_case_id
      and (
        mc.lecturer_id = (select auth.uid())
        or mc.first_marker_id = (select auth.uid())
        or mc.moderator_id = (select auth.uid())
      )
  )
);

drop policy if exists "Lecturers can insert moderation reviews" on public.moderation_reviews;
create policy "Lecturers can insert moderation reviews"
on public.moderation_reviews
for insert
to authenticated
with check (
  reviewer_id = (select auth.uid())
  and exists (
    select 1
    from public.moderation_cases mc
    where mc.id = public.moderation_reviews.moderation_case_id
      and (
        mc.lecturer_id = (select auth.uid())
        or mc.first_marker_id = (select auth.uid())
        or mc.moderator_id = (select auth.uid())
      )
  )
);

-- Remaining submissions moderator read path
drop policy if exists "Assigned moderators can view linked submissions" on public.submissions;
create policy "Assigned moderators can view linked submissions"
on public.submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.moderation_cases mc
    where mc.submission_id = public.submissions.id
      and mc.moderator_id = (select auth.uid())
  )
);
