alter table public.lms_connections enable row level security;
alter table public.lms_provider_tokens enable row level security;
alter table public.lms_courses enable row level security;
alter table public.lms_assignments enable row level security;
alter table public.lms_submissions enable row level security;
alter table public.lms_grades enable row level security;
alter table public.lms_timing_events enable row level security;
alter table public.lms_engagement_events enable row level security;
alter table public.lms_sync_cursors enable row level security;
alter table public.lms_sync_runs enable row level security;
alter table public.lms_audit_log enable row level security;

drop policy if exists "Admins can view LMS connections" on public.lms_connections;
create policy "Admins can view LMS connections"
on public.lms_connections
for select
to authenticated
using (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can insert LMS connections" on public.lms_connections;
create policy "Admins can insert LMS connections"
on public.lms_connections
for insert
to authenticated
with check (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can update LMS connections" on public.lms_connections;
create policy "Admins can update LMS connections"
on public.lms_connections
for update
to authenticated
using (private.is_admin() and private.same_institution(institution_id))
with check (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can delete LMS connections" on public.lms_connections;
create policy "Admins can delete LMS connections"
on public.lms_connections
for delete
to authenticated
using (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can view LMS provider tokens" on public.lms_provider_tokens;
create policy "Admins can view LMS provider tokens"
on public.lms_provider_tokens
for select
to authenticated
using (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can manage LMS provider tokens" on public.lms_provider_tokens;
create policy "Admins can manage LMS provider tokens"
on public.lms_provider_tokens
for all
to authenticated
using (private.is_admin() and private.same_institution(institution_id))
with check (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can view LMS courses" on public.lms_courses;
create policy "Admins can view LMS courses"
on public.lms_courses
for select
to authenticated
using (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can manage LMS courses" on public.lms_courses;
create policy "Admins can manage LMS courses"
on public.lms_courses
for all
to authenticated
using (private.is_admin() and private.same_institution(institution_id))
with check (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can view LMS assignments" on public.lms_assignments;
create policy "Admins can view LMS assignments"
on public.lms_assignments
for select
to authenticated
using (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can manage LMS assignments" on public.lms_assignments;
create policy "Admins can manage LMS assignments"
on public.lms_assignments
for all
to authenticated
using (private.is_admin() and private.same_institution(institution_id))
with check (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can view LMS submissions" on public.lms_submissions;
create policy "Admins can view LMS submissions"
on public.lms_submissions
for select
to authenticated
using (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can manage LMS submissions" on public.lms_submissions;
create policy "Admins can manage LMS submissions"
on public.lms_submissions
for all
to authenticated
using (private.is_admin() and private.same_institution(institution_id))
with check (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can view LMS grades" on public.lms_grades;
create policy "Admins can view LMS grades"
on public.lms_grades
for select
to authenticated
using (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can manage LMS grades" on public.lms_grades;
create policy "Admins can manage LMS grades"
on public.lms_grades
for all
to authenticated
using (private.is_admin() and private.same_institution(institution_id))
with check (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can view LMS timing events" on public.lms_timing_events;
create policy "Admins can view LMS timing events"
on public.lms_timing_events
for select
to authenticated
using (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can manage LMS timing events" on public.lms_timing_events;
create policy "Admins can manage LMS timing events"
on public.lms_timing_events
for all
to authenticated
using (private.is_admin() and private.same_institution(institution_id))
with check (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can view LMS engagement events" on public.lms_engagement_events;
create policy "Admins can view LMS engagement events"
on public.lms_engagement_events
for select
to authenticated
using (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can manage LMS engagement events" on public.lms_engagement_events;
create policy "Admins can manage LMS engagement events"
on public.lms_engagement_events
for all
to authenticated
using (private.is_admin() and private.same_institution(institution_id))
with check (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can view LMS sync cursors" on public.lms_sync_cursors;
create policy "Admins can view LMS sync cursors"
on public.lms_sync_cursors
for select
to authenticated
using (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can manage LMS sync cursors" on public.lms_sync_cursors;
create policy "Admins can manage LMS sync cursors"
on public.lms_sync_cursors
for all
to authenticated
using (private.is_admin() and private.same_institution(institution_id))
with check (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can view LMS sync runs" on public.lms_sync_runs;
create policy "Admins can view LMS sync runs"
on public.lms_sync_runs
for select
to authenticated
using (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can create LMS sync runs" on public.lms_sync_runs;
create policy "Admins can create LMS sync runs"
on public.lms_sync_runs
for insert
to authenticated
with check (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can update LMS sync runs" on public.lms_sync_runs;
create policy "Admins can update LMS sync runs"
on public.lms_sync_runs
for update
to authenticated
using (private.is_admin() and private.same_institution(institution_id))
with check (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can view LMS audit log" on public.lms_audit_log;
create policy "Admins can view LMS audit log"
on public.lms_audit_log
for select
to authenticated
using (private.is_admin() and private.same_institution(institution_id));

drop policy if exists "Admins can insert LMS audit log" on public.lms_audit_log;
create policy "Admins can insert LMS audit log"
on public.lms_audit_log
for insert
to authenticated
with check (private.is_admin() and private.same_institution(institution_id));
