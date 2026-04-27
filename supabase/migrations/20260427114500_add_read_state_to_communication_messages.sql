alter table public.communication_messages
add column if not exists read boolean not null default false;
