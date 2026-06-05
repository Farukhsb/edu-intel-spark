create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table public.communication_messages
drop constraint if exists communication_messages_category_check;

alter table public.communication_messages
add constraint communication_messages_category_check
check (
  category in (
    'feedback-summary',
    'at-risk-alert',
    'grade-released',
    'intervention-follow-up',
    'intervention-overdue-reminder',
    'submission-received',
    'ai-grading-ready',
    'integrity-check-ready',
    'assignment-published'
  )
);

create table if not exists public.intervention_follow_up_settings (
  id integer primary key default 1 check (id = 1),
  scheduler_secret text not null default gen_random_uuid()::text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.intervention_follow_up_settings (id)
values (1)
on conflict (id) do nothing;

create or replace function public.sync_intervention_follow_up_settings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sync_intervention_follow_up_settings_updated_at on public.intervention_follow_up_settings;
create trigger sync_intervention_follow_up_settings_updated_at
  before update on public.intervention_follow_up_settings
  for each row
  execute function public.sync_intervention_follow_up_settings_updated_at();

grant select, update on public.intervention_follow_up_settings to service_role;

do $$
begin
  perform cron.unschedule('weekly-overdue-intervention-reminders');
exception
  when others then
    null;
end $$;

select cron.schedule(
  'weekly-overdue-intervention-reminders',
  '0 4 * * 1',
  $$
    select net.http_post(
      url := 'https://huncjayakgnqdgizzfjx.supabase.co/functions/v1/send-overdue-intervention-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select scheduler_secret from public.intervention_follow_up_settings where id = 1),
        'x-overdue-intervention-reminders-scheduler', 'weekly'
      ),
      body := jsonb_build_object('mode', 'weekly')
    ) as request_id;
  $$
);
