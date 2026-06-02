drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (
  (
    (select auth.uid()) = id
    and private.same_institution(institution_id)
  )
  or (
    private.is_admin()
    and private.current_institution_slug() = 'default'
  )
);
