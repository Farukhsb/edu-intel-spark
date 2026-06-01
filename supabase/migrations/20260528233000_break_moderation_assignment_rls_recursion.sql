create or replace function private.is_assigned_moderator_for_assignment(_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.moderation_cases mc
    where mc.assignment_id = _assignment_id
      and mc.moderator_id = (select auth.uid())
      and private.same_institution(mc.institution_id)
  );
$$;

revoke all on function private.is_assigned_moderator_for_assignment(uuid) from public;
grant execute on function private.is_assigned_moderator_for_assignment(uuid) to authenticated;

drop policy if exists "Assigned moderators can view linked assignments" on public.assignments;
create policy "Assigned moderators can view linked assignments"
on public.assignments
for select
to authenticated
using (
  private.same_institution(institution_id)
  and private.is_assigned_moderator_for_assignment(public.assignments.id)
);
