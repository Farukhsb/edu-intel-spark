drop policy if exists "Users can view own institution" on public.institutions;
create policy "Users can view own institution"
on public.institutions
for select
to authenticated
using (private.same_institution(id));
