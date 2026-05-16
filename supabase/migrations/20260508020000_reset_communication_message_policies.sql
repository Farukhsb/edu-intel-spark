drop policy if exists "users can view relevant communication messages" on public.communication_messages;
drop policy if exists "users can insert communication messages" on public.communication_messages;
drop policy if exists "users can update relevant communication messages" on public.communication_messages;

create policy "users can view relevant communication messages"
on public.communication_messages
for select
to authenticated
using (
  sender_id = (select auth.uid())
  or recipient_id = (select auth.uid())
  or lower(coalesce(recipient_email, '')) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
);

create policy "users can insert communication messages"
on public.communication_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
);

create policy "users can update relevant communication messages"
on public.communication_messages
for update
to authenticated
using (
  sender_id = (select auth.uid())
  or recipient_id = (select auth.uid())
  or lower(coalesce(recipient_email, '')) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
)
with check (
  sender_id = (select auth.uid())
  or recipient_id = (select auth.uid())
  or lower(coalesce(recipient_email, '')) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
);
