create table if not exists public.workflow_notification_log (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  assignment_id uuid null,
  submission_id uuid null,
  recipient_id uuid null,
  dedupe_key text not null unique,
  status text not null default 'pending',
  provider_message_id text null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workflow_notification_log_assignment_id
  on public.workflow_notification_log (assignment_id);

create index if not exists idx_workflow_notification_log_submission_id
  on public.workflow_notification_log (submission_id);

create index if not exists idx_workflow_notification_log_recipient_id
  on public.workflow_notification_log (recipient_id);

create index if not exists idx_workflow_notification_log_status
  on public.workflow_notification_log (status);
