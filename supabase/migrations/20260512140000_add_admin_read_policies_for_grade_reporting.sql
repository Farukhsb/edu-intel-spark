drop policy if exists "Admins can view all grades" on public.grades;
create policy "Admins can view all grades"
on public.grades
for select
to authenticated
using (private.is_admin());

drop policy if exists "Admins can view all grade audit log" on public.grade_audit_log;
create policy "Admins can view all grade audit log"
on public.grade_audit_log
for select
to authenticated
using (private.is_admin());

drop policy if exists "Admins can view all academic integrity reviews" on public.academic_integrity_reviews;
create policy "Admins can view all academic integrity reviews"
on public.academic_integrity_reviews
for select
to authenticated
using (private.is_admin());
