drop policy if exists "Admins can update managed profiles" on public.profiles;
create policy "Admins can update managed profiles"
on public.profiles
for update
to authenticated
using (
  private.is_admin()
  and id <> (select auth.uid())
  and (
    private.same_institution(institution_id)
    or private.current_institution_slug() = 'default'
  )
)
with check (
  private.is_admin()
  and id <> (select auth.uid())
  and (
    private.same_institution(institution_id)
    or private.current_institution_slug() = 'default'
  )
);

drop policy if exists "Admins can manage user roles" on public.user_roles;
create policy "Admins can manage user roles"
on public.user_roles
for all
to authenticated
using (
  private.is_admin()
  and (
    private.same_institution(institution_id)
    or private.current_institution_slug() = 'default'
  )
  and user_id <> (select auth.uid())
)
with check (
  private.is_admin()
  and (
    private.same_institution(institution_id)
    or private.current_institution_slug() = 'default'
  )
  and user_id <> (select auth.uid())
);
