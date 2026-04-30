# Supabase Migration History Reconciliation Plan

This note exists to keep the migration-history problem contained and prevent a
bad live fix.

## Current state

- backup branch for investigation: `fix/supabase-migration-history`
- remote migration ledger contains historical short-form versions:
  - `20260412`
  - `20260413`
- local repo contains matching historical migration files:
  - `20260412_fix_multi_tenant_rls.sql`
  - `20260413_create_student_interventions.sql`
- `supabase migration list --linked --debug` shows the remote ledger does
  contain those exact short-form versions
- Supabase CLI then fails to parse them as 14-digit timestamps, so local and
  remote history do not reconcile cleanly for push operations

## Hard rules

- do not rename the historical short-form migration files on the live branch
- do not mark `20260412` or `20260413` reverted
- do not manually delete or edit production rows in
  `supabase_migrations.schema_migrations`
- do not push new migrations until the historical ledger is safely reconciled

## Recommended path

### Option A: disposable/local baseline experiment

Use this first, on a disposable branch or local-only workspace.

1. Keep the historical short-form migrations as archived history, not
   something to rename in place.
2. Run `npx supabase db pull` against the linked project to capture the current
   remote schema as a fresh baseline migration.
3. Review the generated migration carefully to confirm it reflects the intended
   hosted schema, including:
   - multi-tenant RLS fixes
   - `student_interventions`
   - moderation policy corrections
   - storage restrictions
   - admin helpers and audit objects
4. Compare the pulled baseline to the existing migration chain and decide
   whether future work should be rebased onto a new clean baseline rather than
   continuing to rely on the short-form historical entries for push ordering.
5. Preserve the old short-form files as historical documentation unless a fully
   tested replacement strategy is proven.

This option is investigative. It should be tested locally or on a disposable
project first, not pushed straight to the main hosted environment.

### Option B: escalate through Supabase guidance

If Option A does not produce a safe path, stop and escalate:

1. capture the exact `supabase migration list --linked --debug` output
2. capture the exact short-form file names in `supabase/migrations`
3. open a Supabase support ticket or follow upstream CLI issue guidance for
   historical short-form versions that exist in both local files and remote
   ledger entries but still fail CLI reconciliation

This is safer than forcing a ledger rewrite without a tested vendor-backed
procedure.

## What not to do

- do not rename `20260412_fix_multi_tenant_rls.sql`
- do not rename `20260413_create_student_interventions.sql`
- do not blindly create 14-digit replacements for those files
- do not run `supabase migration repair --status reverted 20260412 20260413`
- do not manually alter the live schema to bypass the migration ledger

## Release implication

The new security migrations created on `2026-04-30` are locally validated, but
remote push remains blocked until the historical short-form migration history is
reconciled safely.

## Baseline experiment result

The remote-only baseline experiment was stopped intentionally before any push.

What was tested on an isolated branch:

- the local-only `2026-04-30` migrations were moved out of active
  `supabase/migrations`
- the short-form anomaly files were kept archived and removed from the active
  migration folder for the experiment
- `npx supabase db pull` was run without any `db push`

Result:

- `db pull` still failed
- after removing the local-only `2026-04-30` migrations from the active folder,
  the remaining blocker was still the remote short-form ledger entries
  `20260412` and `20260413`

Conclusion:

- the active local security migrations are not the root blocker for baseline
  generation
- the short-form records stored in `supabase_migrations.schema_migrations` are
  sufficient on their own to block `supabase db pull`

Do not continue from this point with:

- repair commands
- file renames
- deletion of historical migration files
- manual edits to the migration ledger

Recommended next action:

- escalate to Supabase support or an upstream CLI issue with the debug evidence
- or reproduce the issue on a disposable project before touching production
