alter table public.grading_error_events
  add column if not exists metadata jsonb null;
