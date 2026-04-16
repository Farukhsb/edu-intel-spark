create extension if not exists pgcrypto;

create table if not exists public.communication_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete set null,
  recipient_name text not null,
  recipient_email text,
  category text not null check (
    category in ('feedback-summary', 'at-risk-alert', 'grade-released', 'intervention-follow-up')
  ),
  subject text not null,
  body text not null,
  related_student_id text,
  related_assignment_id text,
  created_at timestamptz not null default now()
);

alter table public.communication_messages enable row level security;

drop policy if exists "users can view relevant communication messages" on public.communication_messages;
drop policy if exists "users can insert communication messages" on public.communication_messages;

create policy "users can view relevant communication messages"
on public.communication_messages
for select
to authenticated
using (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
  or lower(coalesce(recipient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create policy "users can insert communication messages"
on public.communication_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
);
