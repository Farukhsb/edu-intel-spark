create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = _role
      and ur.institution_id = private.user_institution_id(_user_id)
      and private.same_institution(ur.institution_id)
  )
$$;

create or replace function private.is_assignment_owner(_assignment_id uuid)
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
      and a.lecturer_id = (select auth.uid())
      and private.same_institution(a.institution_id)
  )
$$;

create or replace function private.student_matches_assignment_target(_assignment_id uuid, _student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments a
    join public.profiles p
      on p.id = _student_id
    where a.id = _assignment_id
      and a.institution_id = p.institution_id
      and private.same_institution(a.institution_id)
      and (
        exists (
          select 1
          from public.assignment_cohorts ac
          where ac.assignment_id = _assignment_id
            and ac.institution_id = a.institution_id
        )
        or exists (
          select 1
          from public.assignment_departments ad
          where ad.assignment_id = _assignment_id
            and ad.institution_id = a.institution_id
        )
      )
      and (
        not exists (
          select 1
          from public.assignment_cohorts ac
          where ac.assignment_id = _assignment_id
            and ac.institution_id = a.institution_id
        )
        or exists (
          select 1
          from public.assignment_cohorts ac
          where ac.assignment_id = _assignment_id
            and ac.institution_id = a.institution_id
            and ac.cohort_id::text = p.cohort_id
        )
      )
      and (
        not exists (
          select 1
          from public.assignment_departments ad
          where ad.assignment_id = _assignment_id
            and ad.institution_id = a.institution_id
        )
        or exists (
          select 1
          from public.assignment_departments ad
          where ad.assignment_id = _assignment_id
            and ad.institution_id = a.institution_id
            and ad.department_id = p.department_id
        )
      )
  )
$$;

create or replace function public.admin_update_user_profile(
  target_user_id uuid,
  new_full_name text,
  new_role public.app_role,
  new_department_name text,
  new_cohort_id text,
  new_must_change_password boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _actor_id uuid := auth.uid();
  _actor_name text;
  _actor_is_admin boolean;
  _target_profile public.profiles%rowtype;
  _normalized_full_name text := nullif(trim(new_full_name), '');
  _normalized_department_name text := nullif(trim(new_department_name), '');
  _normalized_cohort_id text := nullif(trim(new_cohort_id), '');
  _previous_role text;
  _next_role text := new_role::text;
  _changed_fields text[] := '{}';
begin
  if _actor_id is null then
    raise exception 'Authentication required';
  end if;

  select private.is_admin()
  into _actor_is_admin;

  if not coalesce(_actor_is_admin, false) then
    raise exception 'Only admins can update user profiles';
  end if;

  select full_name
  into _actor_name
  from public.profiles
  where id = _actor_id;

  select *
  into _target_profile
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    raise exception 'Target user was not found';
  end if;

  if _target_profile.institution_id <> private.current_institution_id() then
    raise exception 'Admins can only update users in their institution';
  end if;

  _previous_role := _target_profile.role::text;

  if _target_profile.full_name is distinct from _normalized_full_name then
    _changed_fields := array_append(_changed_fields, 'full_name');
  end if;

  if _previous_role is distinct from _next_role then
    _changed_fields := array_append(_changed_fields, 'role');
  end if;

  if _target_profile.department_name is distinct from _normalized_department_name then
    _changed_fields := array_append(_changed_fields, 'department_name');
  end if;

  if (
    case
      when new_role = 'student' then _normalized_cohort_id
      else null
    end
  ) is distinct from _target_profile.cohort_id then
    _changed_fields := array_append(_changed_fields, 'cohort_id');
  end if;

  if _target_profile.must_change_password is distinct from coalesce(new_must_change_password, false) then
    _changed_fields := array_append(_changed_fields, 'must_change_password');
  end if;

  update public.profiles
  set
    full_name = _normalized_full_name,
    role = new_role,
    department_name = _normalized_department_name,
    department_id = _normalized_department_name,
    cohort_id = case
      when new_role = 'student' then _normalized_cohort_id
      else null
    end,
    must_change_password = coalesce(new_must_change_password, false)
  where id = target_user_id;

  if _previous_role is distinct from _next_role then
    delete from public.user_roles
    where user_id = target_user_id;

    insert into public.user_roles (user_id, role, institution_id)
    values (target_user_id, new_role, _target_profile.institution_id);
  end if;

  insert into public.admin_audit_log (
    actor_id,
    actor_role,
    action_type,
    target_user_id,
    target_user_name,
    target_user_email,
    details,
    institution_id
  )
  values (
    _actor_id,
    'admin',
    'admin_profile_update',
    target_user_id,
    coalesce(_normalized_full_name, _target_profile.full_name, _target_profile.email, 'Unknown user'),
    _target_profile.email,
    jsonb_build_object(
      'actor_name', coalesce(_actor_name, 'Admin'),
      'changed_fields', _changed_fields,
      'role', _next_role,
      'department_name', _normalized_department_name,
      'cohort_id', case when new_role = 'student' then _normalized_cohort_id else null end,
      'must_change_password', coalesce(new_must_change_password, false)
    ),
    _target_profile.institution_id
  );
end;
$$;

grant execute on function public.admin_update_user_profile(
  uuid,
  text,
  public.app_role,
  text,
  text,
  boolean
) to authenticated;

create or replace function public.get_admin_recent_activity()
returns table (
  id text,
  created_at timestamptz,
  title text,
  detail text,
  tone text
)
language sql
stable
security definer
set search_path = public
as $$
  with combined as (
    select
      'assignment-' || a.id::text as id,
      a.created_at,
      coalesce(p.full_name, p.email, 'Unknown lecturer') || ' created ' || a.title as title,
      case
        when a.module_code is not null then 'Assignment tracked under ' || a.module_code || '.'
        else 'New assignment record created.'
      end as detail,
      'neutral'::text as tone
    from public.assignments a
    left join public.profiles p
      on p.id = a.lecturer_id
    where private.is_admin()
      and a.institution_id = private.current_institution_id()

    union all

    select
      'submission-' || s.id::text as id,
      s.submitted_at as created_at,
      coalesce(s.student_name, s.student_email, 'Student record unavailable') || ' submitted work' as title,
      coalesce(a.title, 'Unknown assignment') || ' is now in ' || replace(s.status::text, '_', ' ') || ' state.' as detail,
      case
        when s.status in ('moderation_pending', 'moderation_in_progress', 'escalated') then 'warning'
        else 'neutral'
      end as tone
    from public.submissions s
    left join public.assignments a
      on a.id::text = s.assignment_id
    where private.is_admin()
      and s.institution_id = private.current_institution_id()

    union all

    select
      'moderation-' || mc.id::text as id,
      mc.updated_at as created_at,
      coalesce(a.title, 'Unknown assignment') || ' moderation is ' || replace(mc.status, '_', ' ') as title,
      case
        when mc.integrity_risk_score is not null then
          'Integrity risk ' || round(mc.integrity_risk_score)::text || '%' ||
          case
            when mc.first_marker_score is not null and mc.moderator_score is not null and abs(mc.first_marker_score - mc.moderator_score) >= 5
              then ' and marker disagreement detected.'
            else '.'
          end
        else coalesce(mc.trigger_summary, 'Moderation case updated.')
      end as detail,
      case
        when mc.status = 'escalated' or coalesce(mc.integrity_risk_score, 0) >= 70 then 'warning'
        else 'success'
      end as tone
    from public.moderation_cases mc
    left join public.assignments a
      on a.id = mc.assignment_id
    where private.is_admin()
      and mc.institution_id = private.current_institution_id()

    union all

    select
      'admin-audit-' || aal.id::text as id,
      aal.created_at,
      coalesce(aal.details->>'actor_name', 'Admin') || ' changed user role' as title,
      coalesce(aal.target_user_name, 'Unknown user') as detail,
      'success'::text as tone
    from public.admin_audit_log aal
    where private.is_admin()
      and aal.institution_id = private.current_institution_id()
      and aal.action_type = 'role_changed'

    union all

    select
      'workflow-audit-' || gal.id::text as id,
      gal.created_at,
      'Workflow ' || replace(gal.event_type, '_', ' ') as title,
      coalesce(gal.reason, 'Submission ' || gal.submission_id::text) as detail,
      'neutral'::text as tone
    from public.grade_audit_log gal
    where private.is_admin()
      and gal.institution_id = private.current_institution_id()
  )
  select
    combined.id,
    combined.created_at,
    combined.title,
    combined.detail,
    combined.tone
  from combined
  order by combined.created_at desc
  limit 10
$$;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
  and private.same_institution(institution_id)
);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
  and private.same_institution(institution_id)
)
with check (
  id = (select auth.uid())
  and private.same_institution(institution_id)
);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (
  id = (select auth.uid())
  and private.same_institution(institution_id)
);

drop policy if exists "Users can view own roles" on public.user_roles;
create policy "Users can view own roles"
on public.user_roles
for select
to authenticated
using (
  user_id = (select auth.uid())
  and private.same_institution(institution_id)
);

drop policy if exists "Admins can view admin audit log" on public.admin_audit_log;
create policy "Admins can view admin audit log"
on public.admin_audit_log
for select
to authenticated
using (
  private.is_admin()
  and private.same_institution(institution_id)
);

drop policy if exists "Lecturers can manage own assignment cohorts" on public.assignment_cohorts;
create policy "Lecturers can manage own assignment cohorts"
on public.assignment_cohorts
for all
to authenticated
using (
  private.same_institution(institution_id)
  and private.is_assignment_owner(assignment_id)
)
with check (
  private.same_institution(institution_id)
  and private.is_assignment_owner(assignment_id)
);

drop policy if exists "Lecturers can manage own assignment departments" on public.assignment_departments;
create policy "Lecturers can manage own assignment departments"
on public.assignment_departments
for all
to authenticated
using (
  private.same_institution(institution_id)
  and private.is_assignment_owner(assignment_id)
)
with check (
  private.same_institution(institution_id)
  and private.is_assignment_owner(assignment_id)
);

drop policy if exists "Assigned moderators can view linked assignments" on public.assignments;
create policy "Assigned moderators can view linked assignments"
on public.assignments
for select
to authenticated
using (
  private.same_institution(institution_id)
  and exists (
    select 1
    from public.moderation_cases mc
    where mc.assignment_id = public.assignments.id
      and mc.moderator_id = (select auth.uid())
      and mc.institution_id = public.assignments.institution_id
  )
);

drop policy if exists "Lecturers can manage own assignments" on public.assignments;
create policy "Lecturers can manage own assignments"
on public.assignments
for all
to authenticated
using (
  lecturer_id = (select auth.uid())
  and private.same_institution(institution_id)
)
with check (
  lecturer_id = (select auth.uid())
  and private.same_institution(institution_id)
);

drop policy if exists "Students can view targeted published assignments" on public.assignments;
create policy "Students can view targeted published assignments"
on public.assignments
for select
to authenticated
using (
  status = 'published'
  and private.is_student()
  and private.same_institution(institution_id)
  and private.student_matches_assignment_target(id, (select auth.uid()))
);

drop policy if exists "Admins can view all assignments" on public.assignments;
create policy "Admins can view all assignments"
on public.assignments
for select
to authenticated
using (
  private.is_admin()
  and private.same_institution(institution_id)
);

drop policy if exists "Lecturers can view all profiles" on public.profiles;
drop policy if exists "Lecturers can view lecturer directory" on public.profiles;
create policy "Lecturers can view lecturer directory"
on public.profiles
for select
to authenticated
using (
  private.is_lecturer()
  and role = 'lecturer'
  and private.same_institution(institution_id)
);

drop policy if exists "Lecturers can view linked student profiles" on public.profiles;
create policy "Lecturers can view linked student profiles"
on public.profiles
for select
to authenticated
using (
  private.is_lecturer()
  and role = 'student'
  and private.same_institution(institution_id)
  and (
    exists (
      select 1
      from public.submissions s
      join public.assignments a
        on a.id::text = s.assignment_id
      where s.student_id = public.profiles.id
        and s.institution_id = public.profiles.institution_id
        and a.lecturer_id = (select auth.uid())
        and a.institution_id = public.profiles.institution_id
    )
    or exists (
      select 1
      from public.assignments a
      where a.lecturer_id = (select auth.uid())
        and a.institution_id = public.profiles.institution_id
        and (
          (
            exists (
              select 1
              from public.assignment_cohorts ac
              where ac.assignment_id = a.id
                and ac.institution_id = a.institution_id
            )
            and exists (
              select 1
              from public.assignment_cohorts ac
              where ac.assignment_id = a.id
                and ac.institution_id = a.institution_id
                and ac.cohort_id::text = public.profiles.cohort_id
            )
          )
          or (
            exists (
              select 1
              from public.assignment_departments ad
              where ad.assignment_id = a.id
                and ad.institution_id = a.institution_id
            )
            and exists (
              select 1
              from public.assignment_departments ad
              where ad.assignment_id = a.id
                and ad.institution_id = a.institution_id
                and ad.department_id = public.profiles.department_id
            )
          )
        )
    )
  )
);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
on public.profiles
for select
to authenticated
using (
  private.is_admin()
  and private.same_institution(institution_id)
);

drop policy if exists "Lecturers can manage own interventions" on public.student_interventions;
create policy "Lecturers can manage own interventions"
on public.student_interventions
for all
to authenticated
using (
  lecturer_id = (select auth.uid())
  and private.same_institution(institution_id)
  and (
    assignment_id is null
    or exists (
      select 1
      from public.assignments a
      where a.id = assignment_id
        and a.lecturer_id = (select auth.uid())
        and a.institution_id = public.student_interventions.institution_id
    )
  )
  and (
    student_id is null
    or exists (
      select 1
      from public.submissions s
      join public.assignments a
        on a.id::text = s.assignment_id
      where s.student_id = public.student_interventions.student_id
        and s.institution_id = public.student_interventions.institution_id
        and a.lecturer_id = (select auth.uid())
        and a.institution_id = public.student_interventions.institution_id
    )
  )
)
with check (
  lecturer_id = (select auth.uid())
  and private.same_institution(institution_id)
  and (
    assignment_id is null
    or exists (
      select 1
      from public.assignments a
      where a.id = assignment_id
        and a.lecturer_id = (select auth.uid())
        and a.institution_id = public.student_interventions.institution_id
    )
  )
  and (
    student_id is null
    or exists (
      select 1
      from public.submissions s
      join public.assignments a
        on a.id::text = s.assignment_id
      where s.student_id = public.student_interventions.student_id
        and s.institution_id = public.student_interventions.institution_id
        and a.lecturer_id = (select auth.uid())
        and a.institution_id = public.student_interventions.institution_id
    )
  )
);

drop policy if exists "Students can submit to targeted published assignments" on public.submissions;
create policy "Students can submit to targeted published assignments"
on public.submissions
for insert
to authenticated
with check (
  student_id = (select auth.uid())
  and uploaded_by = (select auth.uid())
  and private.same_institution(institution_id)
  and exists (
    select 1
    from public.assignments a
    where a.id = public.submissions.assignment_id::uuid
      and a.status = 'published'
      and a.institution_id = public.submissions.institution_id
      and private.student_matches_assignment_target(a.id, (select auth.uid()))
  )
);

drop policy if exists "Students can view own submissions" on public.submissions;
create policy "Students can view own submissions"
on public.submissions
for select
to authenticated
using (
  student_id = (select auth.uid())
  and private.same_institution(institution_id)
);

drop policy if exists "Lecturers can view submissions for own assignments" on public.submissions;
create policy "Lecturers can view submissions for own assignments"
on public.submissions
for select
to authenticated
using (
  private.same_institution(institution_id)
  and exists (
    select 1
    from public.assignments a
    where a.id::text = submissions.assignment_id
      and a.lecturer_id = (select auth.uid())
      and a.institution_id = public.submissions.institution_id
  )
);

drop policy if exists "Lecturers can upload submissions for own assignments" on public.submissions;
create policy "Lecturers can upload submissions for own assignments"
on public.submissions
for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and private.same_institution(institution_id)
  and exists (
    select 1
    from public.assignments a
    where a.id::text = submissions.assignment_id
      and a.lecturer_id = (select auth.uid())
      and a.institution_id = public.submissions.institution_id
  )
);

drop policy if exists "Lecturers can update submissions for own assignments" on public.submissions;
create policy "Lecturers can update submissions for own assignments"
on public.submissions
for update
to authenticated
using (
  private.same_institution(institution_id)
  and exists (
    select 1
    from public.assignments a
    where a.id::text = public.submissions.assignment_id
      and a.lecturer_id = (select auth.uid())
      and a.institution_id = public.submissions.institution_id
  )
)
with check (
  private.same_institution(institution_id)
  and exists (
    select 1
    from public.assignments a
    where a.id::text = public.submissions.assignment_id
      and a.lecturer_id = (select auth.uid())
      and a.institution_id = public.submissions.institution_id
  )
  and exists (
    select 1
    from public.submissions original
    where original.id = public.submissions.id
      and original.assignment_id = public.submissions.assignment_id
      and original.institution_id = public.submissions.institution_id
      and coalesce(original.student_id, '00000000-0000-0000-0000-000000000000'::uuid) =
        coalesce(public.submissions.student_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and coalesce(original.student_name, '') = coalesce(public.submissions.student_name, '')
      and coalesce(original.student_email, '') = coalesce(public.submissions.student_email, '')
      and coalesce(original.file_url, '') = coalesce(public.submissions.file_url, '')
      and coalesce(original.file_name, '') = coalesce(public.submissions.file_name, '')
      and coalesce(original.file_type, '') = coalesce(public.submissions.file_type, '')
      and coalesce(original.uploaded_by, '00000000-0000-0000-0000-000000000000'::uuid) =
        coalesce(public.submissions.uploaded_by, '00000000-0000-0000-0000-000000000000'::uuid)
      and original.submitted_at = public.submissions.submitted_at
  )
);

drop policy if exists "Assigned moderators can view linked submissions" on public.submissions;
create policy "Assigned moderators can view linked submissions"
on public.submissions
for select
to authenticated
using (
  private.same_institution(institution_id)
  and exists (
    select 1
    from public.moderation_cases mc
    where mc.submission_id = public.submissions.id
      and mc.moderator_id = (select auth.uid())
      and mc.institution_id = public.submissions.institution_id
  )
);

drop policy if exists "Admins can view all submissions" on public.submissions;
create policy "Admins can view all submissions"
on public.submissions
for select
to authenticated
using (
  private.is_admin()
  and private.same_institution(institution_id)
);

drop policy if exists "Students can view own grades" on public.grades;
create policy "Students can view own grades"
on public.grades
for select
to authenticated
using (
  private.same_institution(institution_id)
  and exists (
    select 1
    from public.submissions s
    where s.id = grades.submission_id
      and s.student_id = (select auth.uid())
      and s.status = 'released'
      and s.institution_id = public.grades.institution_id
  )
);

drop policy if exists "Lecturers can manage grades for own assignments" on public.grades;
create policy "Lecturers can manage grades for own assignments"
on public.grades
for all
to authenticated
using (
  private.same_institution(institution_id)
  and exists (
    select 1
    from public.submissions s
    join public.assignments a
      on a.id::text = s.assignment_id
    where s.id = grades.submission_id
      and s.institution_id = public.grades.institution_id
      and a.lecturer_id = (select auth.uid())
      and a.institution_id = public.grades.institution_id
  )
)
with check (
  private.same_institution(institution_id)
  and exists (
    select 1
    from public.submissions s
    join public.assignments a
      on a.id::text = s.assignment_id
    where s.id = grades.submission_id
      and s.institution_id = public.grades.institution_id
      and a.lecturer_id = (select auth.uid())
      and a.institution_id = public.grades.institution_id
  )
);

drop policy if exists "Admins can view all grades" on public.grades;
create policy "Admins can view all grades"
on public.grades
for select
to authenticated
using (
  private.is_admin()
  and private.same_institution(institution_id)
);

drop policy if exists "users can view relevant communication messages" on public.communication_messages;
create policy "users can view relevant communication messages"
on public.communication_messages
for select
to authenticated
using (
  private.same_institution(institution_id)
  and (
    sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
    or lower(coalesce(recipient_email, '')) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
  )
);

drop policy if exists "users can insert communication messages" on public.communication_messages;
create policy "users can insert communication messages"
on public.communication_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and private.same_institution(institution_id)
);

drop policy if exists "users can update relevant communication messages" on public.communication_messages;
create policy "users can update relevant communication messages"
on public.communication_messages
for update
to authenticated
using (
  private.same_institution(institution_id)
  and (
    sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
    or lower(coalesce(recipient_email, '')) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
  )
)
with check (
  private.same_institution(institution_id)
  and (
    sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
    or lower(coalesce(recipient_email, '')) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
  )
);

drop policy if exists "Lecturers can insert grade audit log" on public.grade_audit_log;
create policy "Lecturers can insert grade audit log"
on public.grade_audit_log
for insert
to authenticated
with check (
  changed_by = (select auth.uid())
  and private.same_institution(institution_id)
  and (
    exists (
      select 1
      from public.submissions s
      join public.assignments a
        on a.id::text = s.assignment_id
      where s.id = public.grade_audit_log.submission_id
        and s.institution_id = public.grade_audit_log.institution_id
        and a.lecturer_id = (select auth.uid())
        and a.institution_id = public.grade_audit_log.institution_id
    )
    or exists (
      select 1
      from public.moderation_cases mc
      where mc.id = public.grade_audit_log.moderation_case_id
        and mc.institution_id = public.grade_audit_log.institution_id
        and (
          mc.moderator_id = (select auth.uid())
          or mc.lecturer_id = (select auth.uid())
        )
    )
  )
);

drop policy if exists "Lecturers can view grade audit log" on public.grade_audit_log;
create policy "Lecturers can view grade audit log"
on public.grade_audit_log
for select
to authenticated
using (
  private.same_institution(institution_id)
  and (
    changed_by = (select auth.uid())
    or exists (
      select 1
      from public.submissions s
      join public.assignments a
        on a.id::text = s.assignment_id
      where s.id = public.grade_audit_log.submission_id
        and s.institution_id = public.grade_audit_log.institution_id
        and a.lecturer_id = (select auth.uid())
        and a.institution_id = public.grade_audit_log.institution_id
    )
    or exists (
      select 1
      from public.moderation_cases mc
      where mc.id = public.grade_audit_log.moderation_case_id
        and mc.institution_id = public.grade_audit_log.institution_id
        and mc.moderator_id = (select auth.uid())
    )
  )
);

drop policy if exists "Admins can view all grade audit log" on public.grade_audit_log;
create policy "Admins can view all grade audit log"
on public.grade_audit_log
for select
to authenticated
using (
  private.is_admin()
  and private.same_institution(institution_id)
);

drop policy if exists "Admins can view all integrity findings" on public.integrity_findings;
create policy "Admins can view all integrity findings"
on public.integrity_findings
for select
to authenticated
using (
  private.is_admin()
  and private.same_institution(institution_id)
);

drop policy if exists "Lecturers can view integrity findings for own assignments" on public.integrity_findings;
create policy "Lecturers can view integrity findings for own assignments"
on public.integrity_findings
for select
to authenticated
using (
  private.same_institution(institution_id)
  and exists (
    select 1
    from public.assignments a
    where a.id = public.integrity_findings.assignment_id
      and a.lecturer_id = (select auth.uid())
      and a.institution_id = public.integrity_findings.institution_id
  )
);

drop policy if exists "Lecturers can insert moderation cases" on public.moderation_cases;
create policy "Lecturers can insert moderation cases"
on public.moderation_cases
for insert
to authenticated
with check (
  lecturer_id = (select auth.uid())
  and first_marker_id = (select auth.uid())
  and private.same_institution(institution_id)
  and exists (
    select 1
    from public.assignments a
    where a.id = public.moderation_cases.assignment_id
      and a.lecturer_id = (select auth.uid())
      and a.institution_id = public.moderation_cases.institution_id
  )
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
    or exists (
      select 1
      from public.assignments a
      where a.id = public.moderation_cases.assignment_id
        and a.lecturer_id = (select auth.uid())
        and a.institution_id = public.moderation_cases.institution_id
    )
  )
)
with check (
  private.same_institution(institution_id)
  and (
    lecturer_id = (select auth.uid())
    or first_marker_id = (select auth.uid())
    or moderator_id = (select auth.uid())
    or exists (
      select 1
      from public.assignments a
      where a.id = public.moderation_cases.assignment_id
        and a.lecturer_id = (select auth.uid())
        and a.institution_id = public.moderation_cases.institution_id
    )
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

drop policy if exists "Lecturers can view assigned moderation cases" on public.moderation_cases;
create policy "Lecturers can view assigned moderation cases"
on public.moderation_cases
for select
to authenticated
using (
  private.same_institution(institution_id)
  and (
    lecturer_id = (select auth.uid())
    or first_marker_id = (select auth.uid())
    or moderator_id = (select auth.uid())
  )
);

drop policy if exists "Admins can view all moderation cases" on public.moderation_cases;
create policy "Admins can view all moderation cases"
on public.moderation_cases
for select
to authenticated
using (
  private.is_admin()
  and private.same_institution(institution_id)
);

drop policy if exists "Lecturers can view own reviews" on public.academic_integrity_reviews;
create policy "Lecturers can view own reviews"
on public.academic_integrity_reviews
for select
to authenticated
using (
  lecturer_id = (select auth.uid())
  and private.same_institution(institution_id)
  and exists (
    select 1
    from public.submissions s
    join public.assignments a
      on a.id::text = s.assignment_id
    where s.id = public.academic_integrity_reviews.submission_id
      and s.institution_id = public.academic_integrity_reviews.institution_id
      and a.lecturer_id = (select auth.uid())
      and a.institution_id = public.academic_integrity_reviews.institution_id
  )
);

drop policy if exists "Lecturers can insert own reviews" on public.academic_integrity_reviews;
create policy "Lecturers can insert own reviews"
on public.academic_integrity_reviews
for insert
to authenticated
with check (
  lecturer_id = (select auth.uid())
  and private.same_institution(institution_id)
  and exists (
    select 1
    from public.submissions s
    join public.assignments a
      on a.id::text = s.assignment_id
    where s.id = public.academic_integrity_reviews.submission_id
      and s.institution_id = public.academic_integrity_reviews.institution_id
      and a.lecturer_id = (select auth.uid())
      and a.institution_id = public.academic_integrity_reviews.institution_id
  )
);

drop policy if exists "Lecturers can update own reviews" on public.academic_integrity_reviews;
create policy "Lecturers can update own reviews"
on public.academic_integrity_reviews
for update
to authenticated
using (
  lecturer_id = (select auth.uid())
  and private.same_institution(institution_id)
  and exists (
    select 1
    from public.submissions s
    join public.assignments a
      on a.id::text = s.assignment_id
    where s.id = public.academic_integrity_reviews.submission_id
      and s.institution_id = public.academic_integrity_reviews.institution_id
      and a.lecturer_id = (select auth.uid())
      and a.institution_id = public.academic_integrity_reviews.institution_id
  )
)
with check (
  lecturer_id = (select auth.uid())
  and private.same_institution(institution_id)
  and exists (
    select 1
    from public.submissions s
    join public.assignments a
      on a.id::text = s.assignment_id
    where s.id = public.academic_integrity_reviews.submission_id
      and s.institution_id = public.academic_integrity_reviews.institution_id
      and a.lecturer_id = (select auth.uid())
      and a.institution_id = public.academic_integrity_reviews.institution_id
  )
);

drop policy if exists "Lecturers can delete own reviews" on public.academic_integrity_reviews;
create policy "Lecturers can delete own reviews"
on public.academic_integrity_reviews
for delete
to authenticated
using (
  lecturer_id = (select auth.uid())
  and private.same_institution(institution_id)
  and exists (
    select 1
    from public.submissions s
    join public.assignments a
      on a.id::text = s.assignment_id
    where s.id = public.academic_integrity_reviews.submission_id
      and s.institution_id = public.academic_integrity_reviews.institution_id
      and a.lecturer_id = (select auth.uid())
      and a.institution_id = public.academic_integrity_reviews.institution_id
  )
);

drop policy if exists "Assigned moderators can view linked integrity reviews" on public.academic_integrity_reviews;
create policy "Assigned moderators can view linked integrity reviews"
on public.academic_integrity_reviews
for select
to authenticated
using (
  (
    private.is_admin()
    or exists (
      select 1
      from public.moderation_cases mc
      where mc.submission_id = public.academic_integrity_reviews.submission_id
        and mc.moderator_id = (select auth.uid())
        and mc.institution_id = public.academic_integrity_reviews.institution_id
    )
  )
  and private.same_institution(institution_id)
);

drop policy if exists "Admins can view all academic integrity reviews" on public.academic_integrity_reviews;
create policy "Admins can view all academic integrity reviews"
on public.academic_integrity_reviews
for select
to authenticated
using (
  private.is_admin()
  and private.same_institution(institution_id)
);

drop policy if exists "Lecturers can view moderation reviews" on public.moderation_reviews;
create policy "Lecturers can view moderation reviews"
on public.moderation_reviews
for select
to authenticated
using (
  private.same_institution(institution_id)
  and (
    reviewer_id = (select auth.uid())
    or exists (
      select 1
      from public.moderation_cases mc
      where mc.id = public.moderation_reviews.moderation_case_id
        and mc.institution_id = public.moderation_reviews.institution_id
        and (
          mc.lecturer_id = (select auth.uid())
          or mc.first_marker_id = (select auth.uid())
          or mc.moderator_id = (select auth.uid())
        )
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
  and private.same_institution(institution_id)
  and exists (
    select 1
    from public.moderation_cases mc
    where mc.id = public.moderation_reviews.moderation_case_id
      and mc.institution_id = public.moderation_reviews.institution_id
      and (
        mc.lecturer_id = (select auth.uid())
        or mc.first_marker_id = (select auth.uid())
        or mc.moderator_id = (select auth.uid())
      )
  )
);

drop policy if exists "Lecturers can view writing profiles for own students" on public.student_writing_profiles;
create policy "Lecturers can view writing profiles for own students"
on public.student_writing_profiles
for select
to authenticated
using (
  private.same_institution(institution_id)
  and exists (
    select 1
    from public.submissions s
    join public.assignments a
      on a.id::text = s.assignment_id
    where s.student_id = public.student_writing_profiles.student_id
      and s.institution_id = public.student_writing_profiles.institution_id
      and a.lecturer_id = (select auth.uid())
      and a.institution_id = public.student_writing_profiles.institution_id
  )
);

drop policy if exists "Students can view own writing profile" on public.student_writing_profiles;
create policy "Students can view own writing profile"
on public.student_writing_profiles
for select
to authenticated
using (
  student_id = (select auth.uid())
  and private.same_institution(institution_id)
);

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
        and private.same_institution(s.institution_id)
        and (
          s.student_id = (select auth.uid())
          or s.uploaded_by = (select auth.uid())
          or exists (
            select 1
            from public.assignments a
            where a.id::text = s.assignment_id
              and a.lecturer_id = (select auth.uid())
              and a.institution_id = s.institution_id
          )
          or exists (
            select 1
            from public.moderation_cases mc
            where mc.submission_id = s.id
              and mc.moderator_id = (select auth.uid())
              and mc.institution_id = s.institution_id
          )
        )
    )
  )
);
