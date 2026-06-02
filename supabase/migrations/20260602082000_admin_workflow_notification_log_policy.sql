grant select on public.workflow_notification_log to authenticated;

drop policy if exists "Admins can read workflow notification log" on public.workflow_notification_log;
create policy "Admins can read workflow notification log"
on public.workflow_notification_log
for select
to authenticated
using (
  private.is_admin()
  and private.same_institution(institution_id)
);
