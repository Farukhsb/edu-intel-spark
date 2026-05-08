# Authorization Reference

This document is the audit shortcut for GradeAI's current authorization model.

Its job is simple:

- map critical workflows to the frontend entry points that trigger them
- identify the tables, RPCs, and Edge Functions those workflows depend on
- point to the current RLS policy source files instead of forcing reviewers to reconstruct intent from the full migration history

This is not a replacement for reviewing migrations. It is a current-state reference layer that makes those reviews faster and less error-prone.

## How To Read This

For each workflow below, check:

1. the page/controller entry point
2. the shared service or workflow helper
3. the database tables involved
4. any RPC or Edge Function boundary
5. the current RLS policies that must hold for the workflow to be safe

When a policy name appears more than once in the migration history, treat the latest file listed here as the current source of truth.

## Canonical Authorization Primitives

The main shared database-side authorization helpers are defined in:

- [`supabase/migrations/20260502212000_move_internal_security_definer_helpers_to_private_schema.sql`](../supabase/migrations/20260502212000_move_internal_security_definer_helpers_to_private_schema.sql)

Important helpers:

- `private.has_role(_user_id, _role)`
- `private.is_admin()`
- `private.is_lecturer()`
- `private.is_student()`
- `private.is_assignment_owner(_assignment_id)`
- `private.student_matches_assignment_target(_assignment_id, _student_id)`

These helpers are reused by current assignment-targeting, profile, and admin-oriented policies.

## Canonical Policy Source Files

These migrations are the main current policy/reference files for the high-risk workflow surfaces:

- [`20260502212000_move_internal_security_definer_helpers_to_private_schema.sql`](../supabase/migrations/20260502212000_move_internal_security_definer_helpers_to_private_schema.sql)
  - private auth helpers
  - assignment targeting helpers
  - assignment cohort/department ownership
  - baseline student assignment visibility and submission targeting
- [`20260502203000_tune_rls_initplan_on_core_tables.sql`](../supabase/migrations/20260502203000_tune_rls_initplan_on_core_tables.sql)
  - assignments
  - communication messages
  - grade audit log
  - moderation cases
  - integrity findings
  - analytics recommendations
  - recommendation actions
  - student writing profiles
- [`20260502204500_tune_remaining_rls_initplan_policies.sql`](../supabase/migrations/20260502204500_tune_remaining_rls_initplan_policies.sql)
  - academic integrity reviews
  - moderation reviews
  - assigned moderator submission reads
- [`20260502195500_consolidate_rls_policies_and_auth_uid_usage.sql`](../supabase/migrations/20260502195500_consolidate_rls_policies_and_auth_uid_usage.sql)
  - submissions base lecturer/student reads
  - grades lecturer management
  - profiles/user_roles/self-service core policies
- [`20260507123000_harden_submission_due_date_and_notification_updates.sql`](../supabase/migrations/20260507123000_harden_submission_due_date_and_notification_updates.sql)
  - due-date-aware student submission insert policy
  - immutable-field-safe communication message updates
- [`20260507160000_harden_grade_visibility_moderation_and_profile_access.sql`](../supabase/migrations/20260507160000_harden_grade_visibility_moderation_and_profile_access.sql)
  - released-only student grade visibility
  - hardened lecturer submission updates
  - hardened grade audit log inserts
  - hardened moderation case inserts/updates
  - narrowed lecturer profile reads
  - released-only student grade projection RPC
- [`20260502223000_add_admin_read_policies_for_dashboard.sql`](../supabase/migrations/20260502223000_add_admin_read_policies_for_dashboard.sql)
  - admin read policies on profiles, assignments, submissions, moderation cases

The main current admin RPC definitions live in:

- [`20260503120500_add_admin_dashboard_metrics_rpc.sql`](../supabase/migrations/20260503120500_add_admin_dashboard_metrics_rpc.sql)
- [`20260503122000_add_admin_assignment_oversight_rpc.sql`](../supabase/migrations/20260503122000_add_admin_assignment_oversight_rpc.sql)
- [`20260503123500_add_admin_moderation_overview_rpc.sql`](../supabase/migrations/20260503123500_add_admin_moderation_overview_rpc.sql)
- [`20260503125000_add_admin_recent_activity_rpc.sql`](../supabase/migrations/20260503125000_add_admin_recent_activity_rpc.sql)

The main current student-grade RPC definition lives in:

- [`20260507160000_harden_grade_visibility_moderation_and_profile_access.sql`](../supabase/migrations/20260507160000_harden_grade_visibility_moderation_and_profile_access.sql)
  - `public.get_student_submission_grade_projection()`

## Workflow Matrix

## 1. Lecturer Creates And Publishes Assignments

Frontend entry points:

- [`src/pages/dashboard/Assignments.tsx`](../src/pages/dashboard/Assignments.tsx)
- [`src/pages/dashboard/assignments/useAssignmentsController.ts`](../src/pages/dashboard/assignments/useAssignmentsController.ts)
- [`src/pages/dashboard/assignments/workflows.ts`](../src/pages/dashboard/assignments/workflows.ts)

Shared workflow/domain helpers:

- [`src/lib/assignmentCatalog.ts`](../src/lib/assignmentCatalog.ts)
- [`src/lib/assignmentPublishWorkflow.ts`](../src/lib/assignmentPublishWorkflow.ts)
- [`src/lib/communications.ts`](../src/lib/communications.ts)

Primary tables:

- `public.assignments`
- `public.assignment_cohorts`
- `public.assignment_departments`
- `public.communication_messages`

RPCs:

- none in the core publish path

Edge Functions:

- none in the current bell-only publish path

Current RLS dependencies:

- `Lecturers can manage own assignments`
- `Lecturers can manage own assignment cohorts`
- `Lecturers can manage own assignment departments`
- `users can insert communication messages`

Current policy sources:

- `assignments`: [`20260502203000_tune_rls_initplan_on_core_tables.sql`](../supabase/migrations/20260502203000_tune_rls_initplan_on_core_tables.sql)
- `assignment_cohorts`, `assignment_departments`: [`20260502212000_move_internal_security_definer_helpers_to_private_schema.sql`](../supabase/migrations/20260502212000_move_internal_security_definer_helpers_to_private_schema.sql)
- `communication_messages`: [`20260502203000_tune_rls_initplan_on_core_tables.sql`](../supabase/migrations/20260502203000_tune_rls_initplan_on_core_tables.sql)

## 2. Student Sees Targeted Published Assignments And Submits Work

Frontend entry points:

- [`src/pages/dashboard/Assignments.tsx`](../src/pages/dashboard/Assignments.tsx)
- [`src/pages/dashboard/AssignmentDetail.tsx`](../src/pages/dashboard/AssignmentDetail.tsx)
- [`src/pages/dashboard/assignment-detail/workflows/useSubmissionActions.ts`](../src/pages/dashboard/assignment-detail/workflows/useSubmissionActions.ts)

Shared workflow/domain helpers:

- [`src/lib/assignmentVisibility.ts`](../src/lib/assignmentVisibility.ts)

Primary tables:

- `public.assignments`
- `public.assignment_cohorts`
- `public.assignment_departments`
- `public.submissions`
- `storage.objects` in the `submissions` bucket

RPCs:

- none in the core submit path

Edge Functions:

- none for the raw submission insert path

Current RLS dependencies:

- `Students can view targeted published assignments`
- `Students can submit to targeted published assignments`
- `Students can view own submissions`
- `Lecturers can view submissions for own assignments`

Current policy sources:

- student assignment visibility: [`20260502212000_move_internal_security_definer_helpers_to_private_schema.sql`](../supabase/migrations/20260502212000_move_internal_security_definer_helpers_to_private_schema.sql)
- due-date-aware submission insert: [`20260507123000_harden_submission_due_date_and_notification_updates.sql`](../supabase/migrations/20260507123000_harden_submission_due_date_and_notification_updates.sql)
- base submission reads: [`20260502195500_consolidate_rls_policies_and_auth_uid_usage.sql`](../supabase/migrations/20260502195500_consolidate_rls_policies_and_auth_uid_usage.sql)

## 3. Lecturer Grades, Reviews, Approves, And Releases Submissions

Frontend entry points:

- [`src/pages/dashboard/AssignmentDetail.tsx`](../src/pages/dashboard/AssignmentDetail.tsx)
- [`src/pages/dashboard/assignment-detail/workflows/useAutomatedAssessmentActions.ts`](../src/pages/dashboard/assignment-detail/workflows/useAutomatedAssessmentActions.ts)
- [`src/pages/dashboard/assignment-detail/workflows/useLecturerAssessmentActions.ts`](../src/pages/dashboard/assignment-detail/workflows/useLecturerAssessmentActions.ts)

Shared workflow/domain helpers:

- [`src/lib/assessmentWorkflow.ts`](../src/lib/assessmentWorkflow.ts)
- [`src/lib/gradeReleaseWorkflow.ts`](../src/lib/gradeReleaseWorkflow.ts)
- [`src/lib/communications.ts`](../src/lib/communications.ts)

Primary tables:

- `public.submissions`
- `public.grades`
- `public.grade_audit_log`
- `public.communication_messages`

RPCs:

- none in the direct review/release write path

Edge Functions:

- `grade-submission`
- `explain-grade`

Current RLS dependencies:

- `Lecturers can view submissions for own assignments`
- `Lecturers can update submissions for own assignments`
- `Lecturers can manage grades for own assignments`
- `Lecturers can insert grade audit log`
- `Lecturers can view grade audit log`
- `users can insert communication messages`

Current policy sources:

- submissions/grades base policies: [`20260502195500_consolidate_rls_policies_and_auth_uid_usage.sql`](../supabase/migrations/20260502195500_consolidate_rls_policies_and_auth_uid_usage.sql)
- hardened submission updates and audit inserts: [`20260507160000_harden_grade_visibility_moderation_and_profile_access.sql`](../supabase/migrations/20260507160000_harden_grade_visibility_moderation_and_profile_access.sql)
- communication messages: [`20260502203000_tune_rls_initplan_on_core_tables.sql`](../supabase/migrations/20260502203000_tune_rls_initplan_on_core_tables.sql)

## 4. Student Views Released Grades And Uses Released-Only Explanation Paths

Frontend entry points:

- [`src/pages/dashboard/StudentGrades.tsx`](../src/pages/dashboard/StudentGrades.tsx)
- [`src/pages/dashboard/ExplainGrade.tsx`](../src/pages/dashboard/ExplainGrade.tsx)

Shared service/domain helpers:

- [`src/lib/studentGradeProjection.ts`](../src/lib/studentGradeProjection.ts)
- [`src/lib/data/academic/academicData.ts`](../src/lib/data/academic/academicData.ts)

Primary tables:

- `public.submissions`
- `public.grades`
- `public.assignments`

RPCs:

- `public.get_student_submission_grade_projection()`
- `public.get_student_grade_assignment_metadata()`

Edge Functions:

- `explain-grade`

Current RLS dependencies:

- `Students can view own submissions`
- `Students can view own grades`

Current policy sources:

- base submission read policy: [`20260502195500_consolidate_rls_policies_and_auth_uid_usage.sql`](../supabase/migrations/20260502195500_consolidate_rls_policies_and_auth_uid_usage.sql)
- released-only grade policy and released-only projection RPC: [`20260507160000_harden_grade_visibility_moderation_and_profile_access.sql`](../supabase/migrations/20260507160000_harden_grade_visibility_moderation_and_profile_access.sql)
- assignment metadata RPC origin: [`20260428150000_add_student_grade_assignment_metadata_rpc.sql`](../supabase/migrations/20260428150000_add_student_grade_assignment_metadata_rpc.sql)

## 5. Lecturer Runs Academic Integrity Review

Frontend entry points:

- [`src/pages/dashboard/AcademicIntegrity.tsx`](../src/pages/dashboard/AcademicIntegrity.tsx)
- [`src/pages/dashboard/academic-integrity/useAcademicIntegrityController.ts`](../src/pages/dashboard/academic-integrity/useAcademicIntegrityController.ts)

Shared service/domain helpers:

- [`src/lib/data/integrity/integrityData.ts`](../src/lib/data/integrity/integrityData.ts)

Primary tables:

- `public.assignments`
- `public.submissions`
- `public.academic_integrity_reviews`
- `public.integrity_findings`

RPCs:

- none in the current lecturer integrity queue path

Edge Functions:

- `check-plagiarism`

Current RLS dependencies:

- `Lecturers can view submissions for own assignments`
- `Lecturers can view own reviews`
- `Lecturers can insert own reviews`
- `Lecturers can update own reviews`
- `Lecturers can delete own reviews`
- `Lecturers can view integrity findings for own assignments`

Current policy sources:

- academic integrity reviews: [`20260502204500_tune_remaining_rls_initplan_policies.sql`](../supabase/migrations/20260502204500_tune_remaining_rls_initplan_policies.sql)
- integrity findings: [`20260502203000_tune_rls_initplan_on_core_tables.sql`](../supabase/migrations/20260502203000_tune_rls_initplan_on_core_tables.sql)
- submission reads: [`20260502195500_consolidate_rls_policies_and_auth_uid_usage.sql`](../supabase/migrations/20260502195500_consolidate_rls_policies_and_auth_uid_usage.sql)

## 6. Lecturer And Moderator Work The Moderation Queue

Frontend entry points:

- [`src/pages/dashboard/ModerationDashboard.tsx`](../src/pages/dashboard/ModerationDashboard.tsx)
- [`src/pages/dashboard/moderation-dashboard/controllers/useModerationDashboardController.ts`](../src/pages/dashboard/moderation-dashboard/controllers/useModerationDashboardController.ts)
- [`src/pages/dashboard/moderation-dashboard/workflows/useModerationActions.ts`](../src/pages/dashboard/moderation-dashboard/workflows/useModerationActions.ts)

Shared service/domain helpers:

- [`src/lib/moderationWorkflow.ts`](../src/lib/moderationWorkflow.ts)
- [`src/lib/moderation.ts`](../src/lib/moderation.ts)
- [`src/lib/data/moderation/moderationData.ts`](../src/lib/data/moderation/moderationData.ts)

Primary tables:

- `public.moderation_cases`
- `public.moderation_reviews`
- `public.grade_audit_log`
- `public.submissions`
- `public.assignments`
- `public.grades`
- `public.profiles`
- `public.academic_integrity_reviews`

RPCs:

- none in the core moderation queue path

Edge Functions:

- none in the direct moderation CRUD path

Current RLS dependencies:

- `Lecturers can view assigned moderation cases`
- `Lecturers can insert moderation cases`
- `Lecturers can update moderation cases`
- `Lecturers can view moderation reviews`
- `Lecturers can insert moderation reviews`
- `Assigned moderators can view linked assignments`
- `Assigned moderators can view linked submissions`
- `Lecturers can view grade audit log`
- `Lecturers can insert grade audit log`

Current policy sources:

- moderation cases and grade audit log: [`20260507160000_harden_grade_visibility_moderation_and_profile_access.sql`](../supabase/migrations/20260507160000_harden_grade_visibility_moderation_and_profile_access.sql)
- moderation case baseline reads and moderator assignment reads: [`20260502203000_tune_rls_initplan_on_core_tables.sql`](../supabase/migrations/20260502203000_tune_rls_initplan_on_core_tables.sql)
- moderation reviews and assigned moderator submission reads: [`20260502204500_tune_remaining_rls_initplan_policies.sql`](../supabase/migrations/20260502204500_tune_remaining_rls_initplan_policies.sql)

## 7. Bell Notifications And Workflow Message Visibility

Frontend entry points:

- [`src/components/DashboardLayout.tsx`](../src/components/DashboardLayout.tsx)
- [`src/lib/communications.ts`](../src/lib/communications.ts)

Shared workflow/domain helpers:

- [`src/lib/lecturerWorkflowNotifications.ts`](../src/lib/lecturerWorkflowNotifications.ts)

Primary tables:

- `public.communication_messages`

RPCs:

- none

Edge Functions:

- none in the current bell-only workflow path

Current RLS dependencies:

- `users can view relevant communication messages`
- `users can insert communication messages`
- `users can update relevant communication messages`

Current policy sources:

- baseline visibility/insert: [`20260502203000_tune_rls_initplan_on_core_tables.sql`](../supabase/migrations/20260502203000_tune_rls_initplan_on_core_tables.sql)
- immutable-field-safe updates: [`20260507123000_harden_submission_due_date_and_notification_updates.sql`](../supabase/migrations/20260507123000_harden_submission_due_date_and_notification_updates.sql)

## 8. Admin Oversight Dashboards

Frontend entry points:

- [`src/pages/dashboard/AdminDashboard.tsx`](../src/pages/dashboard/AdminDashboard.tsx)
- [`src/pages/dashboard/admin-dashboard/controllers/useAdminDashboardController.ts`](../src/pages/dashboard/admin-dashboard/controllers/useAdminDashboardController.ts)

Shared service helpers:

- [`src/lib/data/admin/adminData.ts`](../src/lib/data/admin/adminData.ts)

Primary tables:

- `public.profiles`
- `public.assignments`
- `public.submissions`
- `public.moderation_cases`
- `public.admin_audit_log`
- `public.grade_audit_log`
- `public.communication_messages`
- `public.grades`

RPCs:

- `public.get_admin_dashboard_metrics()`
- `public.get_admin_assignment_oversight()`
- `public.get_admin_moderation_overview()`
- `public.get_admin_recent_activity()`

Edge Functions:

- none in the current admin overview path

Current RLS dependencies:

- `Admins can view all profiles`
- `Admins can view all assignments`
- `Admins can view all submissions`
- `Admins can view all moderation cases`
- `Admins can view admin audit log`
- RPC-internal `private.is_admin()` checks on each admin dashboard RPC

Current policy sources:

- admin read policies: [`20260502223000_add_admin_read_policies_for_dashboard.sql`](../supabase/migrations/20260502223000_add_admin_read_policies_for_dashboard.sql)
- admin audit log policy and auth helpers: [`20260502212000_move_internal_security_definer_helpers_to_private_schema.sql`](../supabase/migrations/20260502212000_move_internal_security_definer_helpers_to_private_schema.sql)
- RPC definitions: 
  - [`20260503120500_add_admin_dashboard_metrics_rpc.sql`](../supabase/migrations/20260503120500_add_admin_dashboard_metrics_rpc.sql)
  - [`20260503122000_add_admin_assignment_oversight_rpc.sql`](../supabase/migrations/20260503122000_add_admin_assignment_oversight_rpc.sql)
  - [`20260503123500_add_admin_moderation_overview_rpc.sql`](../supabase/migrations/20260503123500_add_admin_moderation_overview_rpc.sql)
  - [`20260503125000_add_admin_recent_activity_rpc.sql`](../supabase/migrations/20260503125000_add_admin_recent_activity_rpc.sql)

## 9. Student Support, Improvement Plans, And Recommendation Actions

Frontend entry points:

- [`src/pages/dashboard/ImprovementPlan.tsx`](../src/pages/dashboard/ImprovementPlan.tsx)
- [`src/pages/dashboard/StudentProfile.tsx`](../src/pages/dashboard/StudentProfile.tsx)
- [`src/pages/dashboard/PerformanceTrends.tsx`](../src/pages/dashboard/PerformanceTrends.tsx)

Shared service/domain helpers:

- [`src/lib/improvementPlan.ts`](../src/lib/improvementPlan.ts)
- [`src/lib/data/student/studentAnalyticsData.ts`](../src/lib/data/student/studentAnalyticsData.ts)

Primary tables:

- `public.improvement_plan_progress`
- `public.analytics_recommendations`
- `public.recommendation_actions`
- `public.student_interventions`
- `public.student_writing_profiles`

RPCs:

- none in the current student-support projection path

Edge Functions:

- none

Current RLS dependencies:

- `Students can insert own progress`
- `Students can update own progress`
- `Students can view own progress`
- `Lecturers can view all progress`
- `Lecturers can insert own analytics recommendations`
- `Lecturers can update own analytics recommendations`
- `Lecturers can view own analytics recommendations`
- `Lecturers can insert own recommendation actions`
- `Lecturers can view own recommendation actions`
- `Lecturers can view writing profiles for own students`
- `Students can view own writing profile`
- `Lecturers can manage own interventions`

Current policy sources:

- progress, recommendations, recommendation actions, writing profiles: [`20260502203000_tune_rls_initplan_on_core_tables.sql`](../supabase/migrations/20260502203000_tune_rls_initplan_on_core_tables.sql)
- lecturer interventions: [`20260502195500_consolidate_rls_policies_and_auth_uid_usage.sql`](../supabase/migrations/20260502195500_consolidate_rls_policies_and_auth_uid_usage.sql)
- lecturer progress read helper: [`20260502212000_move_internal_security_definer_helpers_to_private_schema.sql`](../supabase/migrations/20260502212000_move_internal_security_definer_helpers_to_private_schema.sql)

## Review Checklist For Future Audits

When changing a critical workflow:

1. Update the page/controller entry point if the owning feature changes.
2. Update the service helper path if reads/writes move into a new `src/lib` boundary.
3. Update the RLS policy source file reference if a later migration replaces the current definition.
4. Update the RPC list if a direct table read is replaced with a governed function.
5. Update the Edge Function list if a browser write path moves behind a backend boundary.

This document is most useful when it stays current with the latest canonical policy and service boundaries.
