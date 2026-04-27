drop policy if exists "users can update relevant communication messages" on public.communication_messages;

create policy "users can update relevant communication messages"
on public.communication_messages
for update
to authenticated
using (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
  or lower(coalesce(recipient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
with check (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
  or lower(coalesce(recipient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
