# GradeAI Migration Risk Index

This is the short review map for the migrations most likely to affect access
control, workflow safety, or operational behaviour.

Use it before approving migrations that touch RLS, auth helpers, admin
reporting, student visibility, moderation, or communication workflows.

This is not a full migration history. It is a current-state risk index for the
areas where a small SQL change can create a large behavioural regression.

## How to use this

For a migration in one of the categories below:

1. Read the migration itself.
2. Check whether it replaces an earlier policy or helper.
3. Run the automated contract tests:
   - `npm run test:access`
4. Re-run the hosted role-boundary smoke checks if the change touches live access:
   - [`support/LIVE_ROLE_BOUNDARY_SMOKE.md`](support/LIVE_ROLE_BOUNDARY_SMOKE.md)
5. Update [`AUTHORIZATION_REFERENCE.md`](AUTHORIZATION_REFERENCE.md) if the canonical policy source changed.

## Highest-risk categories

### 1. Auth and security-definer helpers

These helpers shape how multiple policies evaluate identity and role.

Key files:

- [`../supabase/migrations/20260502212000_move_internal_security_definer_helpers_to_private_schema.sql`](../supabase/migrations/20260502212000_move_internal_security_definer_helpers_to_private_schema.sql)
- [`../supabase/migrations/20260502193000_harden_security_definer_function_grants.sql`](../supabase/migrations/20260502193000_harden_security_definer_function_grants.sql)

Why this is high risk:

- a mistake here can weaken many policies at once
- helper changes can silently alter auth semantics across unrelated workflows

Re-check after changes:

- student assignment targeting
- lecturer ownership checks
- admin-only RPC access
- any policy using `private.is_admin()`, `private.is_lecturer()`, or `private.student_matches_assignment_target(...)`

### 2. Core RLS policy baselines

These files define the main current access surface for submissions, grades,
profiles, moderation, integrity, and recommendations.

Key files:

- [`../supabase/migrations/20260502195500_consolidate_rls_policies_and_auth_uid_usage.sql`](../supabase/migrations/20260502195500_consolidate_rls_policies_and_auth_uid_usage.sql)
- [`../supabase/migrations/20260502203000_tune_rls_initplan_on_core_tables.sql`](../supabase/migrations/20260502203000_tune_rls_initplan_on_core_tables.sql)
- [`../supabase/migrations/20260502204500_tune_remaining_rls_initplan_policies.sql`](../supabase/migrations/20260502204500_tune_remaining_rls_initplan_policies.sql)

Why this is high risk:

- these migrations control the default read/write envelope for the main app data
- regressions here can expose private records or block ordinary workflows

Re-check after changes:

- lecturer assignment ownership
- student own-submission visibility
- moderator linked submission access
- writing-profile and recommendation ownership

### 3. Released-grade and moderation hardening

These files protect the line between draft academic work and student-visible outcomes.

Key files:

- [`../supabase/migrations/20260507160000_harden_grade_visibility_moderation_and_profile_access.sql`](../supabase/migrations/20260507160000_harden_grade_visibility_moderation_and_profile_access.sql)
- [`../supabase/migrations/20260510110000_harden_moderation_evidence_access.sql`](../supabase/migrations/20260510110000_harden_moderation_evidence_access.sql)

Why this is high risk:

- they control released-only student grade visibility
- they narrow lecturer profile access
- they gate moderation evidence and linked integrity reads

Automated coverage already in place:

- `src/test/accessPolicyContracts.test.ts`

Re-check after changes:

- students only see released grades
- moderators only see linked evidence
- lecturers cannot browse unrestricted student profiles

### 4. Submission and communication workflow hardening

These files protect due-date-aware submission rules and prevent dangerous edits
to communication history.

Key files:

- [`../supabase/migrations/20260507123000_harden_submission_due_date_and_notification_updates.sql`](../supabase/migrations/20260507123000_harden_submission_due_date_and_notification_updates.sql)
- [`../supabase/migrations/20260508004500_fix_submission_targeting_policy_private_helper.sql`](../supabase/migrations/20260508004500_fix_submission_targeting_policy_private_helper.sql)
- [`../supabase/migrations/20260508013000_fix_communication_message_update_policy.sql`](../supabase/migrations/20260508013000_fix_communication_message_update_policy.sql)
- [`../supabase/migrations/20260508020000_reset_communication_message_policies.sql`](../supabase/migrations/20260508020000_reset_communication_message_policies.sql)

Why this is high risk:

- submission policies affect whether students can upload to the right assignment at the right time
- communication message policies affect notification integrity and auditability

Re-check after changes:

- students cannot submit after due dates through normal paths
- communication records cannot be rewritten beyond intended mutable fields
- recipient visibility still matches sender/recipient/email ownership rules

### 5. Admin oversight policies and RPCs

These files control what admin users can read and what reporting functions can expose.

Key files:

- [`../supabase/migrations/20260502223000_add_admin_read_policies_for_dashboard.sql`](../supabase/migrations/20260502223000_add_admin_read_policies_for_dashboard.sql)
- [`../supabase/migrations/20260503120500_add_admin_dashboard_metrics_rpc.sql`](../supabase/migrations/20260503120500_add_admin_dashboard_metrics_rpc.sql)
- [`../supabase/migrations/20260503122000_add_admin_assignment_oversight_rpc.sql`](../supabase/migrations/20260503122000_add_admin_assignment_oversight_rpc.sql)
- [`../supabase/migrations/20260503123500_add_admin_moderation_overview_rpc.sql`](../supabase/migrations/20260503123500_add_admin_moderation_overview_rpc.sql)
- [`../supabase/migrations/20260503125000_add_admin_recent_activity_rpc.sql`](../supabase/migrations/20260503125000_add_admin_recent_activity_rpc.sql)
- [`../supabase/migrations/20260512140000_add_admin_read_policies_for_grade_reporting.sql`](../supabase/migrations/20260512140000_add_admin_read_policies_for_grade_reporting.sql)
- [`../supabase/migrations/20260519233000_admin_profile_management.sql`](../supabase/migrations/20260519233000_admin_profile_management.sql)

Why this is high risk:

- admin reads are intentionally broad
- a missed guard in a security-definer RPC can expose institution-wide records

Re-check after changes:

- every admin RPC still checks `private.is_admin()`
- admin reads remain read-only where intended
- role/profile management writes still create audit evidence

## Practical review rule

Treat migrations in these categories as security-sensitive changes. That means:

- do not approve them on the basis of UI behaviour alone
- check both the SQL and the current workflow contract tests
- re-run live role-boundary smoke checks before calling the environment release-ready
