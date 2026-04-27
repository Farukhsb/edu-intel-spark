alter table public.communication_messages
add column if not exists cleared boolean not null default false;
