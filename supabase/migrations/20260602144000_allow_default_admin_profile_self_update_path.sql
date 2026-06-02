drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (
  (
    id = (select auth.uid())
    and private.same_institution(institution_id)
  )
  or (
    private.is_admin()
    and private.current_institution_slug() = 'default'
  )
)
with check (
  (
    id = (select auth.uid())
    and private.same_institution(institution_id)
  )
  or (
    private.is_admin()
    and private.current_institution_slug() = 'default'
  )
);
