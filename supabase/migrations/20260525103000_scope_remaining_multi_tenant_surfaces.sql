alter table public.analytics_recommendations
add column if not exists institution_id uuid;

alter table public.recommendation_actions
add column if not exists institution_id uuid;

alter table public.academic_access_events
add column if not exists institution_id uuid;

alter table public.grading_error_events
add column if not exists institution_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'analytics_recommendations_institution_id_fkey'
  ) then
    alter table public.analytics_recommendations
      add constraint analytics_recommendations_institution_id_fkey
      foreign key (institution_id)
      references public.institutions(id)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'recommendation_actions_institution_id_fkey'
  ) then
    alter table public.recommendation_actions
      add constraint recommendation_actions_institution_id_fkey
      foreign key (institution_id)
      references public.institutions(id)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'academic_access_events_institution_id_fkey'
  ) then
    alter table public.academic_access_events
      add constraint academic_access_events_institution_id_fkey
      foreign key (institution_id)
      references public.institutions(id)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'grading_error_events_institution_id_fkey'
  ) then
    alter table public.grading_error_events
      add constraint grading_error_events_institution_id_fkey
      foreign key (institution_id)
      references public.institutions(id)
      on delete restrict;
  end if;
end;
$$;

update public.analytics_recommendations ar
set institution_id = coalesce(
  ar.institution_id,
  (
    select a.institution_id
    from public.assignments a
    where a.id = ar.assignment_id
  ),
  private.user_institution_id(ar.lecturer_id),
  private.default_institution_id()
)
where ar.institution_id is null;

update public.recommendation_actions ra
set institution_id = coalesce(
  ra.institution_id,
  (
    select ar.institution_id
    from public.analytics_recommendations ar
    where ar.id = ra.recommendation_id
  ),
  private.user_institution_id(ra.lecturer_id),
  private.default_institution_id()
)
where ra.institution_id is null;

update public.academic_access_events aae
set institution_id = coalesce(
  aae.institution_id,
  (
    select a.institution_id
    from public.assignments a
    where a.id = aae.assignment_id
  ),
  (
    select s.institution_id
    from public.submissions s
    where s.id = aae.submission_id
  ),
  (
    select mc.institution_id
    from public.moderation_cases mc
    where mc.id = aae.moderation_case_id
  ),
  private.user_institution_id(aae.actor_id),
  private.default_institution_id()
)
where aae.institution_id is null;

update public.grading_error_events gee
set institution_id = coalesce(
  gee.institution_id,
  (
    select a.institution_id
    from public.assignments a
    where a.id = gee.assignment_id
  ),
  (
    select s.institution_id
    from public.submissions s
    where s.id = gee.submission_id
  ),
  private.user_institution_id(gee.user_id),
  private.default_institution_id()
)
where gee.institution_id is null;

update public.analytics_recommendations
set institution_id = private.default_institution_id()
where institution_id is null;

update public.recommendation_actions
set institution_id = private.default_institution_id()
where institution_id is null;

update public.academic_access_events
set institution_id = private.default_institution_id()
where institution_id is null;

update public.grading_error_events
set institution_id = private.default_institution_id()
where institution_id is null;

alter table public.analytics_recommendations
alter column institution_id set not null;

alter table public.recommendation_actions
alter column institution_id set not null;

alter table public.academic_access_events
alter column institution_id set not null;

alter table public.grading_error_events
alter column institution_id set not null;

create index if not exists analytics_recommendations_institution_id_idx
  on public.analytics_recommendations (institution_id);

create index if not exists recommendation_actions_institution_id_idx
  on public.recommendation_actions (institution_id);

create index if not exists academic_access_events_institution_id_idx
  on public.academic_access_events (institution_id);

create index if not exists grading_error_events_institution_id_idx
  on public.grading_error_events (institution_id);

create or replace function public.sync_analytics_recommendation_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.institution_id is null and new.assignment_id is not null then
    new.institution_id := private.assignment_institution_id(new.assignment_id);
  end if;

  if new.institution_id is null and new.lecturer_id is not null then
    new.institution_id := private.user_institution_id(new.lecturer_id);
  end if;

  if new.institution_id is null then
    new.institution_id := private.default_institution_id();
  end if;

  return new;
end;
$$;

create or replace function public.sync_recommendation_action_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.institution_id is null then
    select ar.institution_id
    into new.institution_id
    from public.analytics_recommendations ar
    where ar.id = new.recommendation_id;
  end if;

  if new.institution_id is null and new.lecturer_id is not null then
    new.institution_id := private.user_institution_id(new.lecturer_id);
  end if;

  if new.institution_id is null then
    new.institution_id := private.default_institution_id();
  end if;

  return new;
end;
$$;

create or replace function public.sync_academic_access_event_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.institution_id is null and new.assignment_id is not null then
    new.institution_id := private.assignment_institution_id(new.assignment_id);
  end if;

  if new.institution_id is null and new.submission_id is not null then
    new.institution_id := private.submission_institution_id(new.submission_id);
  end if;

  if new.institution_id is null and new.moderation_case_id is not null then
    select mc.institution_id
    into new.institution_id
    from public.moderation_cases mc
    where mc.id = new.moderation_case_id;
  end if;

  if new.institution_id is null and new.actor_id is not null then
    new.institution_id := private.user_institution_id(new.actor_id);
  end if;

  if new.institution_id is null then
    new.institution_id := private.default_institution_id();
  end if;

  return new;
end;
$$;

create or replace function public.sync_grading_error_event_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.institution_id is null and new.assignment_id is not null then
    new.institution_id := private.assignment_institution_id(new.assignment_id);
  end if;

  if new.institution_id is null and new.submission_id is not null then
    new.institution_id := private.submission_institution_id(new.submission_id);
  end if;

  if new.institution_id is null and new.user_id is not null then
    new.institution_id := private.user_institution_id(new.user_id);
  end if;

  if new.institution_id is null then
    new.institution_id := private.default_institution_id();
  end if;

  return new;
end;
$$;

drop trigger if exists sync_analytics_recommendation_institution_id on public.analytics_recommendations;
create trigger sync_analytics_recommendation_institution_id
before insert or update on public.analytics_recommendations
for each row
execute function public.sync_analytics_recommendation_institution_id();

drop trigger if exists sync_recommendation_action_institution_id on public.recommendation_actions;
create trigger sync_recommendation_action_institution_id
before insert or update on public.recommendation_actions
for each row
execute function public.sync_recommendation_action_institution_id();

drop trigger if exists sync_academic_access_event_institution_id on public.academic_access_events;
create trigger sync_academic_access_event_institution_id
before insert or update on public.academic_access_events
for each row
execute function public.sync_academic_access_event_institution_id();

drop trigger if exists sync_grading_error_event_institution_id on public.grading_error_events;
create trigger sync_grading_error_event_institution_id
before insert or update on public.grading_error_events
for each row
execute function public.sync_grading_error_event_institution_id();

drop policy if exists "Lecturers can view own analytics recommendations" on public.analytics_recommendations;
create policy "Lecturers can view own analytics recommendations"
on public.analytics_recommendations
for select
to authenticated
using (
  lecturer_id = (select auth.uid())
  and private.same_institution(institution_id)
  and (
    assignment_id is null
    or exists (
      select 1
      from public.assignments a
      where a.id = public.analytics_recommendations.assignment_id
        and a.lecturer_id = (select auth.uid())
        and a.institution_id = public.analytics_recommendations.institution_id
    )
  )
);

drop policy if exists "Lecturers can insert own analytics recommendations" on public.analytics_recommendations;
create policy "Lecturers can insert own analytics recommendations"
on public.analytics_recommendations
for insert
to authenticated
with check (
  lecturer_id = (select auth.uid())
  and private.same_institution(institution_id)
  and (
    assignment_id is null
    or exists (
      select 1
      from public.assignments a
      where a.id = public.analytics_recommendations.assignment_id
        and a.lecturer_id = (select auth.uid())
        and a.institution_id = public.analytics_recommendations.institution_id
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
  and private.same_institution(institution_id)
  and (
    assignment_id is null
    or exists (
      select 1
      from public.assignments a
      where a.id = public.analytics_recommendations.assignment_id
        and a.lecturer_id = (select auth.uid())
        and a.institution_id = public.analytics_recommendations.institution_id
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
      where a.id = public.analytics_recommendations.assignment_id
        and a.lecturer_id = (select auth.uid())
        and a.institution_id = public.analytics_recommendations.institution_id
    )
  )
);

drop policy if exists "Lecturers can view own recommendation actions" on public.recommendation_actions;
create policy "Lecturers can view own recommendation actions"
on public.recommendation_actions
for select
to authenticated
using (
  lecturer_id = (select auth.uid())
  and private.same_institution(institution_id)
  and exists (
    select 1
    from public.analytics_recommendations ar
    where ar.id = public.recommendation_actions.recommendation_id
      and ar.lecturer_id = (select auth.uid())
      and ar.institution_id = public.recommendation_actions.institution_id
  )
);

drop policy if exists "Lecturers can insert own recommendation actions" on public.recommendation_actions;
create policy "Lecturers can insert own recommendation actions"
on public.recommendation_actions
for insert
to authenticated
with check (
  lecturer_id = (select auth.uid())
  and private.same_institution(institution_id)
  and exists (
    select 1
    from public.analytics_recommendations ar
    where ar.id = public.recommendation_actions.recommendation_id
      and ar.lecturer_id = (select auth.uid())
      and ar.institution_id = public.recommendation_actions.institution_id
  )
);

drop policy if exists "Users can insert own academic access events" on public.academic_access_events;
create policy "Users can insert own academic access events"
on public.academic_access_events
for insert
to authenticated
with check (
  (select auth.uid()) = actor_id
  and private.same_institution(institution_id)
);

drop policy if exists "Admins can view all academic access events" on public.academic_access_events;
create policy "Admins can view all academic access events"
on public.academic_access_events
for select
to authenticated
using (
  private.is_admin()
  and private.same_institution(institution_id)
);

drop policy if exists "Admins can read grading error events" on public.grading_error_events;
create policy "Admins can read grading error events"
on public.grading_error_events
for select
to authenticated
using (
  private.is_admin()
  and private.same_institution(institution_id)
);

create or replace function public.get_student_submission_grade_projection()
returns table (
  submission_id uuid,
  assignment_id uuid,
  assignment_title text,
  module_code text,
  max_score integer,
  file_name text,
  file_url text,
  submission_status public.submission_status,
  submitted_at timestamptz,
  final_score double precision,
  ai_score double precision,
  final_feedback text,
  ai_feedback text,
  ai_breakdown jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id as submission_id,
    a.id as assignment_id,
    a.title as assignment_title,
    a.module_code,
    a.max_score,
    s.file_name,
    s.file_url,
    s.status as submission_status,
    s.submitted_at,
    case when s.status = 'released' then g.final_score else null end as final_score,
    case when s.status = 'released' then g.ai_score else null end as ai_score,
    case when s.status = 'released' then g.final_feedback else null end as final_feedback,
    case when s.status = 'released' then g.ai_feedback else null end as ai_feedback,
    case when s.status = 'released' then g.ai_breakdown::jsonb else null end as ai_breakdown
  from public.submissions s
  join public.assignments a
    on a.id::text = s.assignment_id::text
  left join public.grades g
    on g.submission_id = s.id
    and g.institution_id = s.institution_id
  where s.student_id = auth.uid()
    and s.institution_id = private.current_institution_id()
    and a.institution_id = s.institution_id
  order by s.submitted_at desc
$$;
