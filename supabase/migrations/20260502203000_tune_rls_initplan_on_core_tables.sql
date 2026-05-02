-- Rewrite high-noise RLS policies to use initplan-friendly auth helpers.
-- This keeps the same access semantics while reducing per-row auth lookups.

-- Assignments
drop policy if exists "Assigned moderators can view linked assignments" on public.assignments;
create policy "Assigned moderators can view linked assignments"
on public.assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.moderation_cases mc
    where mc.assignment_id = public.assignments.id
      and mc.moderator_id = (select auth.uid())
  )
);

drop policy if exists "Lecturers can manage own assignments" on public.assignments;
create policy "Lecturers can manage own assignments"
on public.assignments
for all
to authenticated
using (lecturer_id = (select auth.uid()))
with check (lecturer_id = (select auth.uid()));

drop policy if exists "Students can view targeted published assignments" on public.assignments;
create policy "Students can view targeted published assignments"
on public.assignments
for select
to authenticated
using (
  status = 'published'
  and is_student()
  and public.student_matches_assignment_target(id, (select auth.uid()))
);

-- Communication messages
drop policy if exists "users can insert communication messages" on public.communication_messages;
create policy "users can insert communication messages"
on public.communication_messages
for insert
to authenticated
with check (sender_id = (select auth.uid()));

drop policy if exists "users can update relevant communication messages" on public.communication_messages;
create policy "users can update relevant communication messages"
on public.communication_messages
for update
to authenticated
using (
  sender_id = (select auth.uid())
  or recipient_id = (select auth.uid())
  or lower(coalesce(recipient_email, '')) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
)
with check (
  sender_id = (select auth.uid())
  or recipient_id = (select auth.uid())
  or lower(coalesce(recipient_email, '')) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
);

drop policy if exists "users can view relevant communication messages" on public.communication_messages;
create policy "users can view relevant communication messages"
on public.communication_messages
for select
to authenticated
using (
  sender_id = (select auth.uid())
  or recipient_id = (select auth.uid())
  or lower(coalesce(recipient_email, '')) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
);

-- Grade audit log
drop policy if exists "Lecturers can insert grade audit log" on public.grade_audit_log;
create policy "Lecturers can insert grade audit log"
on public.grade_audit_log
for insert
to authenticated
with check (
  changed_by = (select auth.uid())
  or exists (
    select 1
    from public.submissions s
    join public.assignments a
      on a.id::text = s.assignment_id
    where s.id = public.grade_audit_log.submission_id
      and a.lecturer_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.moderation_cases mc
    where mc.id = public.grade_audit_log.moderation_case_id
      and mc.moderator_id = (select auth.uid())
  )
);

drop policy if exists "Lecturers can view grade audit log" on public.grade_audit_log;
create policy "Lecturers can view grade audit log"
on public.grade_audit_log
for select
to authenticated
using (
  changed_by = (select auth.uid())
  or exists (
    select 1
    from public.submissions s
    join public.assignments a
      on a.id::text = s.assignment_id
    where s.id = public.grade_audit_log.submission_id
      and a.lecturer_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.moderation_cases mc
    where mc.id = public.grade_audit_log.moderation_case_id
      and mc.moderator_id = (select auth.uid())
  )
);

-- Improvement plan progress
drop policy if exists "Students can insert own progress" on public.improvement_plan_progress;
create policy "Students can insert own progress"
on public.improvement_plan_progress
for insert
to authenticated
with check (student_id = (select auth.uid()));

drop policy if exists "Students can update own progress" on public.improvement_plan_progress;
create policy "Students can update own progress"
on public.improvement_plan_progress
for update
to authenticated
using (student_id = (select auth.uid()));

drop policy if exists "Students can view own progress" on public.improvement_plan_progress;
create policy "Students can view own progress"
on public.improvement_plan_progress
for select
to authenticated
using (student_id = (select auth.uid()));

-- Integrity findings
drop policy if exists "Admins can view all integrity findings" on public.integrity_findings;
create policy "Admins can view all integrity findings"
on public.integrity_findings
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'admin'
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
);

drop policy if exists "Lecturers can view integrity findings for own assignments" on public.integrity_findings;
create policy "Lecturers can view integrity findings for own assignments"
on public.integrity_findings
for select
to authenticated
using (
  exists (
    select 1
    from public.assignments a
    where a.id = public.integrity_findings.assignment_id
      and a.lecturer_id = (select auth.uid())
  )
);

-- Moderation cases
drop policy if exists "Lecturers can insert moderation cases" on public.moderation_cases;
create policy "Lecturers can insert moderation cases"
on public.moderation_cases
for insert
to authenticated
with check (
  lecturer_id = (select auth.uid())
  or first_marker_id = (select auth.uid())
  or moderator_id = (select auth.uid())
  or exists (
    select 1
    from public.assignments a
    where a.id = public.moderation_cases.assignment_id
      and a.lecturer_id = (select auth.uid())
  )
);

drop policy if exists "Lecturers can update moderation cases" on public.moderation_cases;
create policy "Lecturers can update moderation cases"
on public.moderation_cases
for update
to authenticated
using (
  lecturer_id = (select auth.uid())
  or first_marker_id = (select auth.uid())
  or moderator_id = (select auth.uid())
  or exists (
    select 1
    from public.assignments a
    where a.id = public.moderation_cases.assignment_id
      and a.lecturer_id = (select auth.uid())
  )
)
with check (
  lecturer_id = (select auth.uid())
  or first_marker_id = (select auth.uid())
  or moderator_id = (select auth.uid())
  or exists (
    select 1
    from public.assignments a
    where a.id = public.moderation_cases.assignment_id
      and a.lecturer_id = (select auth.uid())
  )
);

drop policy if exists "Lecturers can view assigned moderation cases" on public.moderation_cases;
create policy "Lecturers can view assigned moderation cases"
on public.moderation_cases
for select
to authenticated
using (
  lecturer_id = (select auth.uid())
  or first_marker_id = (select auth.uid())
  or moderator_id = (select auth.uid())
);

-- Analytics recommendations
drop policy if exists "Lecturers can insert own analytics recommendations" on public.analytics_recommendations;
create policy "Lecturers can insert own analytics recommendations"
on public.analytics_recommendations
for insert
to authenticated
with check (
  lecturer_id = (select auth.uid())
  and (
    assignment_id is null
    or exists (
      select 1
      from public.assignments a
      where a.id = public.analytics_recommendations.assignment_id
        and a.lecturer_id = (select auth.uid())
    )
  )
);

drop policy if exists "Lecturers can update own analytics recommendations" on public.analytics_recommendations;
create policy "Lecturers can update own analytics recommendations"
on public.analytics_recommendations
for update
to authenticated
using (
  lecturer_id = (select auth.uid())
  and (
    assignment_id is null
    or exists (
      select 1
      from public.assignments a
      where a.id = public.analytics_recommendations.assignment_id
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
      where a.id = public.analytics_recommendations.assignment_id
        and a.lecturer_id = (select auth.uid())
    )
  )
);

drop policy if exists "Lecturers can view own analytics recommendations" on public.analytics_recommendations;
create policy "Lecturers can view own analytics recommendations"
on public.analytics_recommendations
for select
to authenticated
using (
  lecturer_id = (select auth.uid())
  and (
    assignment_id is null
    or exists (
      select 1
      from public.assignments a
      where a.id = public.analytics_recommendations.assignment_id
        and a.lecturer_id = (select auth.uid())
    )
  )
);

-- Recommendation actions
drop policy if exists "Lecturers can insert own recommendation actions" on public.recommendation_actions;
create policy "Lecturers can insert own recommendation actions"
on public.recommendation_actions
for insert
to authenticated
with check (
  lecturer_id = (select auth.uid())
  and exists (
    select 1
    from public.analytics_recommendations ar
    where ar.id = public.recommendation_actions.recommendation_id
      and ar.lecturer_id = (select auth.uid())
  )
);

drop policy if exists "Lecturers can view own recommendation actions" on public.recommendation_actions;
create policy "Lecturers can view own recommendation actions"
on public.recommendation_actions
for select
to authenticated
using (
  lecturer_id = (select auth.uid())
  and exists (
    select 1
    from public.analytics_recommendations ar
    where ar.id = public.recommendation_actions.recommendation_id
      and ar.lecturer_id = (select auth.uid())
  )
);

-- Student writing profiles
drop policy if exists "Lecturers can view writing profiles for own students" on public.student_writing_profiles;
create policy "Lecturers can view writing profiles for own students"
on public.student_writing_profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.submissions s
    join public.assignments a
      on a.id::text = s.assignment_id
    where s.student_id = public.student_writing_profiles.student_id
      and a.lecturer_id = (select auth.uid())
  )
);

drop policy if exists "Students can view own writing profile" on public.student_writing_profiles;
create policy "Students can view own writing profile"
on public.student_writing_profiles
for select
to authenticated
using (student_id = (select auth.uid()));
