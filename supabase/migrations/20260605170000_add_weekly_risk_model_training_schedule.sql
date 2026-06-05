create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.risk_model_training_settings (
  id integer primary key default 1 check (id = 1),
  scheduler_secret text not null default gen_random_uuid()::text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.risk_model_training_settings (id)
values (1)
on conflict (id) do nothing;

create or replace function public.sync_risk_model_training_settings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sync_risk_model_training_settings_updated_at on public.risk_model_training_settings;
create trigger sync_risk_model_training_settings_updated_at
  before update on public.risk_model_training_settings
  for each row
  execute function public.sync_risk_model_training_settings_updated_at();

grant select, update on public.risk_model_training_settings to service_role;

do $$
begin
  perform cron.unschedule('weekly-train-risk-model');
exception
  when others then
    null;
end $$;

select cron.schedule(
  'weekly-train-risk-model',
  '0 3 * * 1',
  $$
    select net.http_post(
      url := 'https://huncjayakgnqdgizzfjx.supabase.co/functions/v1/train-risk-model',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select scheduler_secret from public.risk_model_training_settings where id = 1),
        'x-train-risk-model-scheduler', 'weekly'
      ),
      body := jsonb_build_object('mode', 'all')
    ) as request_id;
  $$
);
