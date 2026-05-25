# GDPR Erasure and Data Retention Plan

## Purpose
This document sets out a safe pilot-stage approach for handling user and student data deletion or anonymisation requests in GradeAI.

## What data GradeAI stores
GradeAI currently stores or references:
- user account and profile data
- user roles and institution relationships
- assignments and targeting metadata
- submissions and uploaded file references
- grades, feedback, and grading metadata
- moderation cases and moderation reviews
- academic integrity findings and review records
- communication messages and notification history
- analytics recommendations, intervention records, and audit events
- workflow and grading error telemetry

## Tables likely to contain user or student data
Based on the current schema and migrations, the most relevant tables are:
- `profiles`
- `user_roles`
- `institutions`
- `assignments`
- `assignment_cohorts`
- `assignment_departments`
- `submissions`
- `grades`
- `grade_audit_log`
- `moderation_cases`
- `moderation_reviews`
- `academic_integrity_reviews`
- `integrity_findings`
- `student_interventions`
- `student_writing_profiles`
- `communication_messages`
- `workflow_notification_log`
- `analytics_recommendations`
- `recommendation_actions`
- `academic_access_events`
- `grading_error_events`

Storage objects in the `submissions` bucket must also be considered because uploaded files may contain personal data.

## Delete vs anonymise
### Delete
Delete means removing records entirely, including linked uploaded files where permitted. This is the strongest form of erasure but may conflict with academic record retention, audit obligations, or moderation history requirements.

### Anonymise
Anonymise means retaining the operational record while removing or replacing identifying fields. In practice this may be safer for pilot use when institutions still need evidence that a workflow occurred without retaining the person’s identity.

## Recommended pilot approach
For pilot stage, the safer default is:
1. assess whether the request can lawfully be fulfilled as full deletion
2. if academic or governance obligations require retention, anonymise instead of deleting
3. remove or sever uploaded file references where possible
4. keep a restricted audit record that the request was processed

This balances GDPR expectations with academic governance and dispute-handling needs.

## Proposed admin deletion workflow
Recommended future workflow:
1. admin searches for the user or student record
2. system shows all linked records and affected tables
3. admin chooses:
   - full deletion where allowed
   - anonymisation where retention is required
4. system executes the operation in a controlled server-side function
5. system records a non-public audit entry with:
   - who approved it
   - why it was done
   - whether records were deleted or anonymised
   - timestamp and institution context

## Audit logging requirement
Any erasure mechanism should write a dedicated audit event. That audit event should avoid storing the full deleted content, but should record:
- requestor identity
- approving administrator
- institution context
- target user identifier
- affected record categories
- delete vs anonymise decision
- timestamp

## Risks before implementation
Current risks if deletion is implemented too quickly:
- deleting records that institutions must retain
- breaking foreign key relationships or historical dashboards
- leaving uploaded files behind after database rows are removed
- incomplete anonymisation that still leaves a student identifiable
- removing evidence needed for moderation, appeals, or misconduct review

## Phase recommendation
Do not implement destructive deletion until:
- the full table map and dependencies are confirmed
- storage deletion behavior is reviewed
- institution-specific retention rules are agreed
- the audit logging path is designed and tested

For pilot readiness, document the process first, then implement a scoped admin-only workflow in a separate reviewed phase.
