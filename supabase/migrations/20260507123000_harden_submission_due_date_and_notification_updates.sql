drop policy if exists "Students can submit to targeted published assignments" on public.submissions;

create policy "Students can submit to targeted published assignments"
on public.submissions
for insert
to authenticated
with check (
  student_id = auth.uid()
  and uploaded_by = auth.uid()
  and exists (
    select 1
    from public.assignments a
    where a.id = submissions.assignment_id::uuid
      and a.status = 'published'
      and (a.due_date is null or a.due_date > now())
      and public.student_matches_assignment_target(a.id, auth.uid())
  )
);

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
  (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
    or lower(coalesce(recipient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  and exists (
    select 1
    from public.communication_messages original
    where original.id = id
      and original.sender_id = sender_id
      and original.recipient_id is not distinct from recipient_id
      and original.recipient_name = recipient_name
      and original.recipient_email is not distinct from recipient_email
      and original.category = category
      and original.subject = subject
      and original.body = body
      and original.related_student_id is not distinct from related_student_id
      and original.related_assignment_id is not distinct from related_assignment_id
  )
);
