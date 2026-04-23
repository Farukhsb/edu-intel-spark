# Migration And Schema Baseline

This document describes the database baseline that is currently considered trustworthy, the corrective migrations that matter most, and the steps to verify the schema from scratch.

## Why this exists

The project has had a few rounds of policy fixes, hosted/local drift cleanup, and follow-up corrections. The goal here is not to list every migration in the repo. It is to make it clear which migrations define the current stable baseline and how to confirm that a fresh database matches it.

## Major corrective migrations

These are the migrations that most directly shaped the current baseline.

- `20260421101500_harden_permissions_rls_audit.sql`
  - tightened permission and RLS behavior after earlier policy drift
- `20260422091500_allow_assigned_moderators_linked_actions.sql`
  - restored moderation actions for assigned moderators in the linked workflow path
- `20260422110000_align_moderation_rls_with_hosted_state.sql`
  - aligned local moderation policies with the hosted state that was already working
- `20260423105000_restrict_submission_storage_reads.sql`
  - removed lecturer-wide submission file access and tied storage reads to authorized submission visibility
- `20260423143000_add_admin_set_user_role_rpc.sql`
  - added the protected `public.admin_set_user_role(...)` RPC for admin-driven student/lecturer role changes
- `20260423152000_fix_admin_set_user_role_ambiguity.sql`
  - fixed the first RPC version so it no longer fails at runtime on ambiguous `user_id` references

## Hosted drift that was normalized

The hosted project needed a small amount of migration-history repair before the current baseline could be trusted.

- remote history contained legacy versions `20260412` and `20260413` that did not exist as local migration files
- those entries were repaired in migration history so linked pushes could continue cleanly
- `20260422091500` had to be marked as already applied on hosted because the remote schema already matched that policy state
- after that repair work, the linked hosted project accepted the missing corrective migrations, including the storage restriction and admin role RPC fixes

This matters because the current database story is not just "local migrations exist." It is "local and hosted were reconciled to the same intended state."

## Current known-good migration baseline

The current baseline is considered good when all local migrations apply cleanly through:

- `20260423152000_fix_admin_set_user_role_ambiguity.sql`

At that point, the following are expected to be true:

- moderation RLS reflects the hosted-aligned policy set
- submission storage reads are no longer lecturer-wide
- `public.admin_set_user_role(target_user_id uuid, target_role app_role)` exists
- the role-change RPC works for:
  - `student -> lecturer`
  - `lecturer -> student`

## Current caveat

There is still one known schema-model inconsistency to keep in mind:

- the frontend now recognizes `admin`
- the local historical role model in migrations and generated types still centers on `student` and `lecturer`

That means the migration baseline is operationally good for the current app, but the role model is not fully cleaned up yet. Treat that as a follow-up alignment task, not as proof that the current corrective migrations are invalid.

## How to validate schema from scratch

Use this sequence when you want a clean, defensible schema check.

1. Reset the local database:

```powershell
npx supabase db reset --local
```

2. Confirm the latest corrective migrations were applied:

- `20260422110000_align_moderation_rls_with_hosted_state.sql`
- `20260423105000_restrict_submission_storage_reads.sql`
- `20260423143000_add_admin_set_user_role_rpc.sql`
- `20260423152000_fix_admin_set_user_role_ambiguity.sql`

3. Verify the admin role-change function exists:

```sql
select
  proname
from pg_proc
where proname = 'admin_set_user_role';
```

4. Verify the protected behavior that the baseline depends on:

- moderation UI path still loads with the aligned moderation policies
- unrelated lecturers cannot read other users' submission files
- admin role changes work through `public.admin_set_user_role(...)`

5. If you need to compare local and hosted migration state, check the linked project:

```powershell
npx supabase migration list --linked
```

You should not see new unexplained remote-only versions before pushing more schema changes.

## Practical verification checklist

When validating the baseline after a reset or after pushing migrations, these are the highest-value checks:

- local reset completes without migration failure
- moderation dashboard still works on the intended assigned-moderator path
- submission files are readable only through authorized submission relationships
- admin can promote a student to lecturer
- admin can demote a lecturer to student
- role changes update both `public.profiles.role` and `public.user_roles`

## What this document does not claim

This baseline document does not mean the database is fully cleaned up forever. It only captures the current known-good point:

- the main policy corrections are in place
- the key hosted drift was normalized
- the schema can be reset locally and reasoned about again

If future migrations touch roles, moderation RLS, or storage policies, this document should be updated at the same time.
