-- Record workflow email delivery attempts so duplicate requests do not resend
-- the same notification for the same workflow event.

create table if not exists public.workflow_notification_log (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null,
  notification_type text not null check (
    notification_type in ('assignment-published', 'submission-received', 'grade-released')
  ),
  assignment_id uuid references public.assignments(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete cascade,
  recipient_email text not null,
  triggered_by uuid references public.profiles(id) on delete set null,
  delivery_status text not null default 'pending' check (
    delivery_status in ('pending', 'sent', 'failed')
  ),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workflow_notification_log_submission
  on public.workflow_notification_log (submission_id, notification_type);

create index if not exists idx_workflow_notification_log_assignment
  on public.workflow_notification_log (assignment_id, notification_type);

create unique index if not exists idx_workflow_notification_log_active_dedupe
  on public.workflow_notification_log (dedupe_key)
  where delivery_status in ('pending', 'sent');

alter table public.workflow_notification_log enable row level security;

drop trigger if exists update_workflow_notification_log_updated_at on public.workflow_notification_log;
create trigger update_workflow_notification_log_updated_at
  before update on public.workflow_notification_log
  for each row
  execute function public.update_updated_at_column();

comment on table public.workflow_notification_log is
'Tracks workflow email deliveries so repeated requests can be safely deduplicated without resending the same workflow notification.';
