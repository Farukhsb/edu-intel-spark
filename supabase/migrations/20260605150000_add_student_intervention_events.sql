create table if not exists public.student_intervention_events (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.student_interventions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  lecturer_id uuid not null references public.profiles(id) on delete cascade,
  contact_target_type text not null check (
    contact_target_type in (
      'student',
      'parent',
      'guardian',
      'tutor',
      'course_leader',
      'department_head',
      'support_service',
      'placement_supervisor',
      'employer',
      'other'
    )
  ),
  contact_target_name text not null,
  contact_method text not null check (
    contact_method in (
      'email',
      'meeting',
      'phone',
      'lms_message',
      'sms',
      'in_person',
      'referral',
      'other'
    )
  ),
  contacted_at timestamptz not null default now(),
  outcome text not null check (
    outcome in (
      'no_response',
      'left_message',
      'responded',
      'attended',
      'referred',
      'resolved',
      'follow_up_scheduled',
      'escalated',
      'ongoing',
      'other'
    )
  ),
  summary text not null,
  next_step text,
  institution_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_intervention_events_intervention_id_idx
  on public.student_intervention_events (intervention_id);

create index if not exists student_intervention_events_student_id_idx
  on public.student_intervention_events (student_id);

create index if not exists student_intervention_events_lecturer_id_idx
  on public.student_intervention_events (lecturer_id);

create index if not exists student_intervention_events_contacted_at_idx
  on public.student_intervention_events (contacted_at desc);

create index if not exists student_intervention_events_institution_id_idx
  on public.student_intervention_events (institution_id);

create trigger update_student_intervention_events_updated_at
  before update on public.student_intervention_events
  for each row
  execute function public.update_student_interventions_updated_at();

create or replace function public.sync_student_intervention_event_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  intervention_institution_id uuid;
begin
  select si.institution_id
    into intervention_institution_id
  from public.student_interventions si
  where si.id = new.intervention_id;

  new.institution_id := coalesce(
    new.institution_id,
    intervention_institution_id,
    private.user_institution_id(new.lecturer_id),
    private.user_institution_id(new.student_id),
    private.default_institution_id()
  );

  return new;
end;
$$;

drop trigger if exists sync_student_intervention_event_institution_id on public.student_intervention_events;
create trigger sync_student_intervention_event_institution_id
before insert or update on public.student_intervention_events
for each row
execute function public.sync_student_intervention_event_institution_id();

alter table public.student_intervention_events enable row level security;

drop policy if exists "Lecturers can manage own intervention events" on public.student_intervention_events;
create policy "Lecturers can manage own intervention events"
on public.student_intervention_events
for all
to authenticated
using (
  (
    public.is_admin()
    or lecturer_id = auth.uid()
  )
  and exists (
    select 1
    from public.student_interventions si
    where si.id = student_intervention_events.intervention_id
      and si.institution_id = student_intervention_events.institution_id
      and (
        public.is_admin()
        or si.lecturer_id = auth.uid()
      )
  )
)
with check (
  (
    public.is_admin()
    or lecturer_id = auth.uid()
  )
  and exists (
    select 1
    from public.student_interventions si
    where si.id = student_intervention_events.intervention_id
      and si.institution_id = student_intervention_events.institution_id
      and (
        public.is_admin()
        or si.lecturer_id = auth.uid()
      )
  )
);

grant select, insert, update, delete on public.student_intervention_events to authenticated;
