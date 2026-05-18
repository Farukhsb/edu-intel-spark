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
- `20260424101500_add_admin_role_and_harden_signup.sql`
  - added `admin` to the real database role model and stopped public signup from creating admin accounts
- `20260424102000_add_is_admin_helper.sql`
  - added `public.is_admin()` so admin-aware checks do not have to keep reimplementing the same logic
- `20260424113000_add_admin_audit_log.sql`
  - added the admin audit log table and the role-change audit write path used by `admin_set_user_role(...)`

## Hosted drift that was normalized

The hosted project needed a small amount of migration-history repair before the current baseline could be trusted.

- remote history contained legacy versions `20260412` and `20260413` that did not exist as local migration files
- those entries were repaired in migration history so linked pushes could continue cleanly
- `20260422091500` had to be marked as already applied on hosted because the remote schema already matched that policy state
- after that repair work, the linked hosted project accepted the missing corrective migrations, including the storage restriction and admin role RPC fixes

This matters because the current database story is not just "local migrations exist." It is "local and hosted were reconciled to the same intended state."

## Current migration ledger caveat

The linked Supabase project's migration ledger still contains two historical
short-form versions:

- `20260412`
- `20260413`

The local repo also contains matching historical migration files with the same
short-form prefixes:

- `20260412_fix_multi_tenant_rls.sql`
- `20260413_create_student_interventions.sql`

This is not currently a missing-file problem. The issue is that Supabase CLI
expects migration versions to parse cleanly as 14-digit timestamps in parts of
its reconciliation flow. When it encounters these short-form versions, it fails
to match local and remote history cleanly even though both sides contain the
same logical migrations.

As a result:

- `supabase migration list --linked` shows `20260412` and `20260413` as split local-only and remote-only entries
- `supabase db push --dry-run` remains blocked on "Remote migration versions not found in local migrations directory"
- the new security migrations added on `2026-04-30` are locally validated, but should not be pushed remotely until the historical migration ledger is safely reconciled

Until there is a tested reconciliation plan:

- do not rename the historical short-form migration files
- do not mark those migrations reverted
- do not manually alter the remote schema to work around the ledger mismatch

## Current known-good migration baseline

The current baseline is considered good when all local migrations apply cleanly through:

- `20260424113000_add_admin_audit_log.sql`

At that point, the following are expected to be true:

- moderation RLS reflects the hosted-aligned policy set
- submission storage reads are no longer lecturer-wide
- `admin` exists in `public.app_role`
- public signup cannot create admin users through signup metadata
- `public.is_admin()` exists
- `public.admin_set_user_role(target_user_id uuid, target_role app_role)` exists
- `public.admin_audit_log` exists
- the role-change RPC works for:
  - `student -> lecturer`
  - `lecturer -> student`

## Current caveat

The main caveat now is less about the enum itself and more about rollout discipline:

- the schema and generated types now include `admin`
- but new admin-facing migrations still need to be applied consistently in every real environment before those features are fully live there

In practice, if an environment is missing `20260424113000_add_admin_audit_log.sql`, the app should still load, but admin audit history will not be active there yet.

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
- `20260424101500_add_admin_role_and_harden_signup.sql`
- `20260424102000_add_is_admin_helper.sql`
- `20260424113000_add_admin_audit_log.sql`

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
- admin audit rows are written when role changes happen in an environment where the audit migration is applied

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
- admin audit rows appear for successful role changes when the audit migration is live

## What this document does not claim

This baseline document does not mean the database is fully cleaned up forever. It only captures the current known-good point:

- the main policy corrections are in place
- the key hosted drift was normalized
- the schema can be reset locally and reasoned about again

If future migrations touch roles, moderation RLS, or storage policies, this document should be updated at the same time.
