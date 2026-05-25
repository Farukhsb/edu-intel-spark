alter table public.assignments add column if not exists institution_id uuid;
alter table public.assignment_cohorts add column if not exists institution_id uuid;
alter table public.assignment_departments add column if not exists institution_id uuid;
alter table public.submissions add column if not exists institution_id uuid;
alter table public.grades add column if not exists institution_id uuid;
alter table public.academic_integrity_reviews add column if not exists institution_id uuid;
alter table public.integrity_findings add column if not exists institution_id uuid;
alter table public.moderation_cases add column if not exists institution_id uuid;
alter table public.moderation_reviews add column if not exists institution_id uuid;
alter table public.grade_audit_log add column if not exists institution_id uuid;
alter table public.communication_messages add column if not exists institution_id uuid;
alter table public.student_interventions add column if not exists institution_id uuid;
alter table public.student_writing_profiles add column if not exists institution_id uuid;
alter table public.workflow_notification_log add column if not exists institution_id uuid;
alter table public.admin_audit_log add column if not exists institution_id uuid;

do $$
declare
  _table_name text;
  _constraint_name text;
begin
  foreach _table_name in array array[
    'assignments',
    'assignment_cohorts',
    'assignment_departments',
    'submissions',
    'grades',
    'academic_integrity_reviews',
    'integrity_findings',
    'moderation_cases',
    'moderation_reviews',
    'grade_audit_log',
    'communication_messages',
    'student_interventions',
    'student_writing_profiles',
    'workflow_notification_log',
    'admin_audit_log'
  ]
  loop
    _constraint_name := _table_name || '_institution_id_fkey';
    if not exists (
      select 1
      from pg_constraint
      where conname = _constraint_name
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (institution_id) references public.institutions(id) on delete restrict',
        _table_name,
        _constraint_name
      );
    end if;
  end loop;
end;
$$;

create or replace function public.try_parse_uuid(_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  if _value is null or btrim(_value) = '' then
    return null;
  end if;

  if _value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return _value::uuid;
  end if;

  return null;
end;
$$;

create or replace function private.default_institution_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.institutions
  where slug = 'default'
$$;

create or replace function private.assignment_institution_id(_assignment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.institution_id
  from public.assignments a
  where a.id = _assignment_id
$$;

create or replace function private.submission_institution_id(_submission_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.institution_id
  from public.submissions s
  where s.id = _submission_id
$$;

revoke all on function public.try_parse_uuid(text) from public;
revoke all on function private.default_institution_id() from public;
revoke all on function private.assignment_institution_id(uuid) from public;
revoke all on function private.submission_institution_id(uuid) from public;

grant execute on function public.try_parse_uuid(text) to authenticated;
grant execute on function private.default_institution_id() to authenticated;
grant execute on function private.assignment_institution_id(uuid) to authenticated;
grant execute on function private.submission_institution_id(uuid) to authenticated;

update public.assignments a
set institution_id = coalesce(
  a.institution_id,
  private.user_institution_id(a.lecturer_id),
  private.default_institution_id()
)
where a.institution_id is null;

update public.assignment_cohorts ac
set institution_id = coalesce(
  ac.institution_id,
  private.assignment_institution_id(ac.assignment_id),
  private.default_institution_id()
)
where ac.institution_id is null;

update public.assignment_departments ad
set institution_id = coalesce(
  ad.institution_id,
  private.assignment_institution_id(ad.assignment_id),
  private.default_institution_id()
)
where ad.institution_id is null;

update public.submissions s
set institution_id = coalesce(
  s.institution_id,
  private.assignment_institution_id(public.try_parse_uuid(s.assignment_id::text)),
  private.user_institution_id(s.student_id),
  private.user_institution_id(s.uploaded_by),
  private.default_institution_id()
)
where s.institution_id is null;

update public.grades g
set institution_id = coalesce(
  g.institution_id,
  private.submission_institution_id(g.submission_id),
  private.default_institution_id()
)
where g.institution_id is null;

update public.academic_integrity_reviews air
set institution_id = coalesce(
  air.institution_id,
  private.submission_institution_id(air.submission_id),
  private.user_institution_id(air.lecturer_id),
  private.default_institution_id()
)
where air.institution_id is null;

update public.integrity_findings i
set institution_id = coalesce(
  i.institution_id,
  private.assignment_institution_id(i.assignment_id),
  private.submission_institution_id(i.submission_id),
  private.default_institution_id()
)
where i.institution_id is null;

update public.moderation_cases mc
set institution_id = coalesce(
  mc.institution_id,
  private.assignment_institution_id(mc.assignment_id),
  private.submission_institution_id(mc.submission_id),
  private.user_institution_id(mc.lecturer_id),
  private.default_institution_id()
)
where mc.institution_id is null;

update public.moderation_reviews mr
set institution_id = coalesce(
  mr.institution_id,
  (
    select mc.institution_id
    from public.moderation_cases mc
    where mc.id = mr.moderation_case_id
  ),
  private.submission_institution_id(mr.submission_id),
  private.user_institution_id(mr.reviewer_id),
  private.default_institution_id()
)
where mr.institution_id is null;

update public.grade_audit_log gal
set institution_id = coalesce(
  gal.institution_id,
  private.submission_institution_id(gal.submission_id),
  (
    select mc.institution_id
    from public.moderation_cases mc
    where mc.id = gal.moderation_case_id
  ),
  private.user_institution_id(gal.changed_by),
  private.default_institution_id()
)
where gal.institution_id is null;

update public.communication_messages cm
set institution_id = coalesce(
  cm.institution_id,
  private.assignment_institution_id(public.try_parse_uuid(cm.related_assignment_id)),
  private.user_institution_id(cm.sender_id),
  private.user_institution_id(cm.recipient_id),
  private.default_institution_id()
)
where cm.institution_id is null;

update public.student_interventions si
set institution_id = coalesce(
  si.institution_id,
  private.assignment_institution_id(si.assignment_id),
  private.user_institution_id(si.lecturer_id),
  private.user_institution_id(si.student_id),
  private.default_institution_id()
)
where si.institution_id is null;

update public.student_writing_profiles swp
set institution_id = coalesce(
  swp.institution_id,
  private.user_institution_id(swp.student_id),
  private.default_institution_id()
)
where swp.institution_id is null;

update public.workflow_notification_log wnl
set institution_id = coalesce(
  wnl.institution_id,
  private.assignment_institution_id(wnl.assignment_id),
  private.submission_institution_id(wnl.submission_id),
  private.user_institution_id(wnl.recipient_id),
  private.default_institution_id()
)
where wnl.institution_id is null;

update public.admin_audit_log aal
set institution_id = coalesce(
  aal.institution_id,
  private.user_institution_id(aal.actor_id),
  private.user_institution_id(aal.target_user_id),
  private.default_institution_id()
)
where aal.institution_id is null;

update public.assignments set institution_id = private.default_institution_id() where institution_id is null;
update public.assignment_cohorts set institution_id = private.default_institution_id() where institution_id is null;
update public.assignment_departments set institution_id = private.default_institution_id() where institution_id is null;
update public.submissions set institution_id = private.default_institution_id() where institution_id is null;
update public.grades set institution_id = private.default_institution_id() where institution_id is null;
update public.academic_integrity_reviews set institution_id = private.default_institution_id() where institution_id is null;
update public.integrity_findings set institution_id = private.default_institution_id() where institution_id is null;
update public.moderation_cases set institution_id = private.default_institution_id() where institution_id is null;
update public.moderation_reviews set institution_id = private.default_institution_id() where institution_id is null;
update public.grade_audit_log set institution_id = private.default_institution_id() where institution_id is null;
update public.communication_messages set institution_id = private.default_institution_id() where institution_id is null;
update public.student_interventions set institution_id = private.default_institution_id() where institution_id is null;
update public.student_writing_profiles set institution_id = private.default_institution_id() where institution_id is null;
update public.workflow_notification_log set institution_id = private.default_institution_id() where institution_id is null;
update public.admin_audit_log set institution_id = private.default_institution_id() where institution_id is null;

alter table public.assignments alter column institution_id set not null;
alter table public.assignment_cohorts alter column institution_id set not null;
alter table public.assignment_departments alter column institution_id set not null;
alter table public.submissions alter column institution_id set not null;
alter table public.grades alter column institution_id set not null;
alter table public.academic_integrity_reviews alter column institution_id set not null;
alter table public.integrity_findings alter column institution_id set not null;
alter table public.moderation_cases alter column institution_id set not null;
alter table public.moderation_reviews alter column institution_id set not null;
alter table public.grade_audit_log alter column institution_id set not null;
alter table public.communication_messages alter column institution_id set not null;
alter table public.student_interventions alter column institution_id set not null;
alter table public.student_writing_profiles alter column institution_id set not null;
alter table public.workflow_notification_log alter column institution_id set not null;
alter table public.admin_audit_log alter column institution_id set not null;

create index if not exists assignments_institution_id_idx on public.assignments (institution_id);
create index if not exists assignment_cohorts_institution_id_idx on public.assignment_cohorts (institution_id);
create index if not exists assignment_departments_institution_id_idx on public.assignment_departments (institution_id);
create index if not exists submissions_institution_id_idx on public.submissions (institution_id);
create index if not exists grades_institution_id_idx on public.grades (institution_id);
create index if not exists academic_integrity_reviews_institution_id_idx on public.academic_integrity_reviews (institution_id);
create index if not exists integrity_findings_institution_id_idx on public.integrity_findings (institution_id);
create index if not exists moderation_cases_institution_id_idx on public.moderation_cases (institution_id);
create index if not exists moderation_reviews_institution_id_idx on public.moderation_reviews (institution_id);
create index if not exists grade_audit_log_institution_id_idx on public.grade_audit_log (institution_id);
create index if not exists communication_messages_institution_id_idx on public.communication_messages (institution_id);
create index if not exists student_interventions_institution_id_idx on public.student_interventions (institution_id);
create index if not exists student_writing_profiles_institution_id_idx on public.student_writing_profiles (institution_id);
create index if not exists workflow_notification_log_institution_id_idx on public.workflow_notification_log (institution_id);
create index if not exists admin_audit_log_institution_id_idx on public.admin_audit_log (institution_id);

create or replace function public.sync_assignment_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
    private.user_institution_id(new.lecturer_id),
    private.default_institution_id()
  );
  return new;
end;
$$;

create or replace function public.sync_assignment_link_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
    private.assignment_institution_id(new.assignment_id),
    private.default_institution_id()
  );
  return new;
end;
$$;

create or replace function public.sync_submission_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
    private.assignment_institution_id(new.assignment_id),
    private.user_institution_id(new.student_id),
    private.user_institution_id(new.uploaded_by),
    private.default_institution_id()
  );
  return new;
end;
$$;

create or replace function public.sync_grade_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
    private.submission_institution_id(new.submission_id),
    private.default_institution_id()
  );
  return new;
end;
$$;

create or replace function public.sync_academic_integrity_review_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
    private.submission_institution_id(new.submission_id),
    private.user_institution_id(new.lecturer_id),
    private.default_institution_id()
  );
  return new;
end;
$$;

create or replace function public.sync_integrity_finding_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
    private.assignment_institution_id(new.assignment_id),
    private.submission_institution_id(new.submission_id),
    private.default_institution_id()
  );
  return new;
end;
$$;

create or replace function public.sync_moderation_case_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
    private.assignment_institution_id(new.assignment_id),
    private.submission_institution_id(new.submission_id),
    private.user_institution_id(new.lecturer_id),
    private.default_institution_id()
  );
  return new;
end;
$$;

create or replace function public.sync_moderation_review_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
    (
      select mc.institution_id
      from public.moderation_cases mc
      where mc.id = new.moderation_case_id
    ),
    private.submission_institution_id(new.submission_id),
    private.user_institution_id(new.reviewer_id),
    private.default_institution_id()
  );
  return new;
end;
$$;

create or replace function public.sync_grade_audit_log_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
    private.submission_institution_id(new.submission_id),
    (
      select mc.institution_id
      from public.moderation_cases mc
      where mc.id = new.moderation_case_id
    ),
    private.user_institution_id(new.changed_by),
    private.default_institution_id()
  );
  return new;
end;
$$;

create or replace function public.sync_communication_message_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
    private.assignment_institution_id(public.try_parse_uuid(new.related_assignment_id)),
    private.user_institution_id(new.sender_id),
    private.user_institution_id(new.recipient_id),
    private.default_institution_id()
  );
  return new;
end;
$$;

create or replace function public.sync_student_intervention_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
    private.assignment_institution_id(new.assignment_id),
    private.user_institution_id(new.lecturer_id),
    private.user_institution_id(new.student_id),
    private.default_institution_id()
  );
  return new;
end;
$$;

create or replace function public.sync_student_writing_profile_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
    private.user_institution_id(new.student_id),
    private.default_institution_id()
  );
  return new;
end;
$$;

create or replace function public.sync_workflow_notification_log_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
    private.assignment_institution_id(new.assignment_id),
    private.submission_institution_id(new.submission_id),
    private.user_institution_id(new.recipient_id),
    private.default_institution_id()
  );
  return new;
end;
$$;

create or replace function public.sync_admin_audit_log_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
    private.user_institution_id(new.actor_id),
    private.user_institution_id(new.target_user_id),
    private.default_institution_id()
  );
  return new;
end;
$$;

drop trigger if exists sync_assignment_institution_id on public.assignments;
create trigger sync_assignment_institution_id
before insert or update on public.assignments
for each row
execute function public.sync_assignment_institution_id();

drop trigger if exists sync_assignment_cohort_institution_id on public.assignment_cohorts;
create trigger sync_assignment_cohort_institution_id
before insert or update on public.assignment_cohorts
for each row
execute function public.sync_assignment_link_institution_id();

drop trigger if exists sync_assignment_department_institution_id on public.assignment_departments;
create trigger sync_assignment_department_institution_id
before insert or update on public.assignment_departments
for each row
execute function public.sync_assignment_link_institution_id();

drop trigger if exists sync_submission_institution_id on public.submissions;
create trigger sync_submission_institution_id
before insert or update on public.submissions
for each row
execute function public.sync_submission_institution_id();

drop trigger if exists sync_grade_institution_id on public.grades;
create trigger sync_grade_institution_id
before insert or update on public.grades
for each row
execute function public.sync_grade_institution_id();

drop trigger if exists sync_academic_integrity_review_institution_id on public.academic_integrity_reviews;
create trigger sync_academic_integrity_review_institution_id
before insert or update on public.academic_integrity_reviews
for each row
execute function public.sync_academic_integrity_review_institution_id();

drop trigger if exists sync_integrity_finding_institution_id on public.integrity_findings;
create trigger sync_integrity_finding_institution_id
before insert or update on public.integrity_findings
for each row
execute function public.sync_integrity_finding_institution_id();

drop trigger if exists sync_moderation_case_institution_id on public.moderation_cases;
create trigger sync_moderation_case_institution_id
before insert or update on public.moderation_cases
for each row
execute function public.sync_moderation_case_institution_id();

drop trigger if exists sync_moderation_review_institution_id on public.moderation_reviews;
create trigger sync_moderation_review_institution_id
before insert or update on public.moderation_reviews
for each row
execute function public.sync_moderation_review_institution_id();

drop trigger if exists sync_grade_audit_log_institution_id on public.grade_audit_log;
create trigger sync_grade_audit_log_institution_id
before insert or update on public.grade_audit_log
for each row
execute function public.sync_grade_audit_log_institution_id();

drop trigger if exists sync_communication_message_institution_id on public.communication_messages;
create trigger sync_communication_message_institution_id
before insert or update on public.communication_messages
for each row
execute function public.sync_communication_message_institution_id();

drop trigger if exists sync_student_intervention_institution_id on public.student_interventions;
create trigger sync_student_intervention_institution_id
before insert or update on public.student_interventions
for each row
execute function public.sync_student_intervention_institution_id();

drop trigger if exists sync_student_writing_profile_institution_id on public.student_writing_profiles;
create trigger sync_student_writing_profile_institution_id
before insert or update on public.student_writing_profiles
for each row
execute function public.sync_student_writing_profile_institution_id();

drop trigger if exists sync_workflow_notification_log_institution_id on public.workflow_notification_log;
create trigger sync_workflow_notification_log_institution_id
before insert or update on public.workflow_notification_log
for each row
execute function public.sync_workflow_notification_log_institution_id();

drop trigger if exists sync_admin_audit_log_institution_id on public.admin_audit_log;
create trigger sync_admin_audit_log_institution_id
before insert or update on public.admin_audit_log
for each row
execute function public.sync_admin_audit_log_institution_id();
