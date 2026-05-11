drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
on public.profiles
for select
to authenticated
using (private.is_admin());

drop policy if exists "Admins can view all assignments" on public.assignments;
create policy "Admins can view all assignments"
on public.assignments
for select
to authenticated
using (private.is_admin());

drop policy if exists "Admins can view all submissions" on public.submissions;
create policy "Admins can view all submissions"
on public.submissions
for select
to authenticated
using (private.is_admin());

drop policy if exists "Admins can view all moderation cases" on public.moderation_cases;
create policy "Admins can view all moderation cases"
on public.moderation_cases
for select
to authenticated
using (private.is_admin());
