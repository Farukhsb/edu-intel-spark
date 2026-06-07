alter table public.grading_error_events
  add column if not exists institution_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'grading_error_events_institution_id_fkey'
  ) then
    alter table public.grading_error_events
      add constraint grading_error_events_institution_id_fkey
      foreign key (institution_id) references public.institutions(id) on delete restrict;
  end if;
end;
$$;

update public.grading_error_events ge
set institution_id = coalesce(
  ge.institution_id,
  private.submission_institution_id(ge.submission_id),
  private.assignment_institution_id(ge.assignment_id),
  private.user_institution_id(ge.user_id),
  private.default_institution_id()
)
where ge.institution_id is null;

update public.grading_error_events
set institution_id = private.default_institution_id()
where institution_id is null;

alter table public.grading_error_events
  alter column institution_id set not null;

create index if not exists grading_error_events_institution_id_idx
  on public.grading_error_events (institution_id);

alter table public.grading_error_events enable row level security;

create or replace function public.sync_grading_error_event_institution_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.institution_id := coalesce(
    new.institution_id,
    private.submission_institution_id(new.submission_id),
    private.assignment_institution_id(new.assignment_id),
    private.user_institution_id(new.user_id),
    private.default_institution_id()
  );
  return new;
end;
$$;

drop trigger if exists sync_grading_error_event_institution_id on public.grading_error_events;
create trigger sync_grading_error_event_institution_id
  before insert or update on public.grading_error_events
  for each row
  execute function public.sync_grading_error_event_institution_id();

drop policy if exists "Admins can read grading error events" on public.grading_error_events;
create policy "Admins can read grading error events"
on public.grading_error_events
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
  and private.same_institution(institution_id)
);
