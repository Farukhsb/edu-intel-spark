# Multi-Tenancy Implementation Plan

## Current position
GradeAI already contains a substantial institution-scoping foundation in the local schema, Supabase types, and contract tests. This phase does not introduce new multi-tenancy migrations. It documents the current shape, rollout risks, and what still needs review before further database change is approved.

## Existing identity model
The current model already uses:
- `profiles` for account-level details
- `user_roles` for role assignment
- `institutions` as the top-level organisation boundary

The migration and contract files show helper functions such as:
- `private.user_institution_id(...)`
- `private.current_institution_id()`
- `private.same_institution(...)`

## Current department and cohort structure
Department and cohort relationships are already part of the user and assignment model:
- `profiles.department_name`
- `profiles.department_id`
- `profiles.cohort_id`
- `assignment_departments`
- `assignment_cohorts`

These need to remain institution-scoped so assignment targeting cannot leak across institutions.

## Tables that need institution_id
The current migration chain indicates that the following tables either already have or should continue to carry `institution_id`:
- `profiles`
- `user_roles`
- `assignments`
- `submissions`
- `grades`
- `academic_integrity_reviews`
- `communication_messages`
- `workflow_notification_log`
- `analytics_recommendations`
- `recommendation_actions`
- `academic_access_events`
- `grading_error_events`
- `moderation_cases`
- `moderation_reviews`
- `integrity_findings`
- `grade_audit_log`
- `student_interventions`
- `student_writing_profiles`
- `assignment_cohorts`
- `assignment_departments`

## Required foreign keys
Where not already present, each institution-scoped table should reference:
- `institutions.id`

The safest pattern is:
- backfill `institution_id`
- add foreign key
- add indexes
- enforce `not null`
- then update RLS and triggers

## RLS policies that must be reviewed
The main policy groups that require institution-aware review are:
- `profiles`
- `user_roles`
- `assignments`
- `submissions`
- `grades`
- `academic_integrity_reviews`
- `moderation_cases`
- `moderation_reviews`
- `communication_messages`
- `grade_audit_log`
- `integrity_findings`
- `analytics_recommendations`
- `recommendation_actions`
- `academic_access_events`
- `grading_error_events`
- storage access policies for uploaded submission files

Particular care is needed for:
- lecturer update policies on `submissions`
- any policy using self-referential checks
- storage policies tied to `submissions.file_url`

## Migration risks
The key risks are:
- partial backfills leaving rows with null or incorrect institution ownership
- recursive RLS checks causing update failures
- cross-institution leaks through reporting RPCs or storage policies
- existing data attached to the default institution when a more specific institution should be assigned
- role reassignment or bootstrap-admin flows weakening tenant isolation

## Backfill strategy for existing data
Recommended backfill order:
1. establish `institutions`
2. backfill `profiles` and `user_roles`
3. derive `institution_id` for assignments from lecturer ownership
4. derive `institution_id` for submissions and grades from assignments
5. derive workflow and audit tables from their nearest assignment/submission/actor relationship
6. add triggers to keep future writes aligned
7. only then tighten `not null` and RLS enforcement

## Testing plan
Before any further remote multi-tenancy rollout:
1. run migration contract tests
2. verify institution-scoped reads for student, lecturer, moderator, and admin roles
3. verify cross-institution denial paths
4. verify storage object access for submissions
5. verify all reporting RPCs are institution-scoped
6. verify grade save, submission status update, moderation, integrity, and analytics workflows still function after RLS tightening

## Recommended phase split
Phase A:
- review current migration chain
- confirm linked database state versus local migrations
- identify any unapplied institution-scoping migrations

Phase B:
- apply only reviewed, ordered migrations to a non-production environment
- run role-based regression tests

Phase C:
- promote reviewed migrations to the live environment with rollback notes and audit capture

## Recommendation
Do not add new institution columns or remote migrations in this phase. The current need is review, confirmation, and rollout planning, not more schema churn.
