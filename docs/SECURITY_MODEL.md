# GradeAI Security Model

## Purpose

GradeAI handles academic assessment data, so security has to be treated as part of the product, not as an afterthought.

This document explains the current security model in plain English. It is written for people who want to understand how the platform protects users, submissions, grades, feedback, and academic decisions without needing to read the whole codebase.

GradeAI is still a developing product, so this document should be read as a working security model rather than a final institutional security certification.

## Security Principles

GradeAI is built around a few simple principles:

- users should only see the data they are allowed to see
- students should not see provisional AI marks or unreleased feedback
- lecturers remain responsible for academic decisions
- integrity results should support review, not automatically accuse students
- sensitive data should not be sent to logs, monitoring tools, or external services unless there is a clear reason and appropriate protection
- database permissions matter as much as frontend checks

The platform should never rely only on the user interface to protect data. The backend and database rules must enforce the real boundaries.

## Main User Roles

GradeAI currently works around these main roles.

### Students

Students can submit work, view released grades, read approved feedback, use student support tools, and review improvement plans. They should not be able to see other students' submissions, grades, integrity results, or private lecturer notes.

### Lecturers

Lecturers can create assignments, review submissions, run AI-assisted grading, check integrity signals, approve or edit feedback, release grades, and monitor support signals for students linked to their teaching activity.

### Moderators

Moderators can review work that has been sent for moderation. Their access should be limited to the cases they are assigned to or are allowed to review under the moderation workflow.

### Admins

Admins have broader oversight, but admin access should still be treated carefully. Admin views should support operational oversight and reporting rather than bypassing academic judgement unnecessarily.

In the current app, admin role changes are intentionally narrow:

- the UI only supports `student` and `lecturer` transitions
- admin users cannot promote someone to `admin` from the UI
- role changes require explicit confirmation
- backend role changes write to `admin_audit_log`
- admin assignment and submission views remain read-only oversight surfaces

## Access Control

Access control in GradeAI is handled through a combination of:

- application roles
- Supabase authentication
- database row-level security policies
- route guards in the frontend
- backend checks inside Supabase Edge Functions

The important point is that frontend routing is not enough. A hidden button or protected page does not fully secure the system. The database and backend functions must also check who the user is and what they are allowed to access.

## Row-Level Security

Supabase Row-Level Security is one of the most important parts of the security model.

RLS policies are expected to control which rows a user can read or change. For example:

- a lecturer should only access assignments and submissions connected to their teaching context
- a student should only access their own released grades and feedback
- moderation records should only be visible to the right lecturer, moderator, or admin role
- audit records should not be freely editable by normal users

This means the database is not treated as an open store where the frontend decides what to show. The database has to help enforce the rules.

## Student Grade Visibility

A key rule in GradeAI is that students should not see provisional AI output.

The intended flow is:

```text
submitted
  -> AI-assisted grading
  -> lecturer review
  -> approval
  -> release
  -> student visibility
```

This protects students from seeing draft marks or unreviewed feedback. It also protects lecturers from being pressured by AI-generated results that were never meant to be final.

## AI-Assisted Grading

AI-assisted grading is treated as decision support.

The AI can help prepare draft marks, feedback, and rubric-level comments, but the lecturer must review the output before release. The platform should not present AI grading as a final academic decision.

Security and fairness concerns here include:

- AI output may be incomplete or wrong
- generated feedback may need editing
- students should not see draft AI feedback before lecturer approval
- marks should be traceable through the review and release process

The human review stage is part of the safety model, not just a product feature.

## Academic Integrity Review

Academic integrity results are treated as evidence for review, not proof of misconduct.

The system may highlight similarity, uncited overlap, cited overlap, reference sections, internal peer overlap, external overlap, or AI-writing indicators. These signals should help lecturers decide what to inspect more closely.

The platform should avoid language that automatically accuses students. A lecturer or authorised reviewer should make the final judgement based on the evidence and the institution's policy.

## Early Support Signals

The early support feature highlights students whose assessment patterns suggest they may benefit from extra support.

This is not designed to label students. It is designed to help lecturers notice possible issues earlier.

The support signal is based on explainable factors such as grade trends, low averages, sudden drops, inconsistent results, expected next outcome, and limited available data. These signals should be used as prompts for lecturer review, not automatic decisions about a student.

## File Storage

Student submissions and related files should be stored with restricted access.

The expected model is:

- students can access their own relevant files and released feedback
- lecturers can access submissions linked to their assignments
- moderators can access files linked to assigned moderation cases
- admins should only access files when there is a legitimate operational reason

File URLs, storage buckets, and download paths should not expose private student work to unauthorised users.

## Edge Functions

Supabase Edge Functions are used for heavier backend tasks such as grading, integrity checks, and student-facing explanations.

These functions should not simply trust data passed from the browser. They should check the authenticated user, confirm the user's role where needed, and only operate on data the user is allowed to access.

Edge Functions should also avoid logging sensitive content such as full student submissions, private feedback, or personal data.

## Logging and Monitoring

As the platform moves closer to wider use, error monitoring should be added carefully.

Tools such as Sentry or Datadog can help detect crashes, failed requests, and production issues, but they must be configured in a privacy-safe way.

Monitoring should not capture:

- full student submissions
- full feedback text
- private notes
- unnecessary personal data
- secrets or API keys

Useful monitoring should focus on errors, affected routes, environment, release version, and safe technical context.

## Data Minimisation

GradeAI should only collect and store data that is needed for the academic workflow.

That includes information such as users, roles, assignments, submissions, grades, feedback, moderation records, integrity results, and intervention records.

The platform should avoid collecting unnecessary personal information. Where data is no longer needed, future versions should define retention and deletion rules.

## Data Residency

GradeAI uses cloud services, so data residency needs to be considered before institutional deployment.

For a real university pilot, the deployment region, Supabase project region, storage location, monitoring tools, AI providers, and backup arrangements should be reviewed against the institution's requirements.

This is especially important for student submissions and assessment records.

At the current stage, data residency should be documented as an institutional-readiness item rather than treated as solved for every possible university environment.

## Audit Trails

Audit trails are important because academic decisions need to be explainable after the event.

GradeAI should record important actions such as:

- grade approval
- grade release
- lecturer overrides
- moderation decisions
- integrity review decisions
- admin actions
- intervention logging

The purpose is not to create surveillance. The purpose is to make academic workflows fairer, more transparent, and easier to review.

## Common Risks and How GradeAI Responds

| Risk | Response |
|---|---|
| Student sees unreleased grades | Use release states and access controls so only approved and released feedback is visible |
| Lecturer accesses the wrong cohort | Use role checks and RLS policies tied to assignment ownership or permitted access |
| Moderator sees cases they should not see | Restrict moderation visibility to assigned or authorised cases |
| AI output is treated as final | Keep lecturer review and approval as required steps before release |
| Integrity result is treated as an accusation | Present integrity signals as evidence for review, not proof of misconduct |
| Sensitive student data appears in logs | Avoid logging submissions, private feedback, notes, and unnecessary personal data |
| Prompt injection affects AI features | Treat AI output as untrusted, keep human review, and avoid letting prompts execute privileged actions |
| Misconfigured database policy exposes data | Keep RLS policies reviewed, tested, and documented alongside migrations |
| Admin access becomes too broad | Use admin views for oversight, not unnecessary bypassing of academic workflows |

## Current Limitations

The current project has several strong security foundations, including role-based workflows, Supabase RLS direction, moderation boundaries, and review-before-release design.

However, before institutional-scale use, the following areas should be strengthened:

- formal security review of all RLS policies
- clearer automated tests for role boundaries
- monitoring with privacy-safe error capture
- documented data retention and deletion rules
- documented data residency position for any pilot institution
- regular review of Edge Function permissions and logs
- stronger test coverage around student visibility and moderation access

## Institutional Rollout Position

GradeAI should not be presented as ready for immediate institution-wide deployment after a short build period.

A responsible rollout should move in stages:

1. internal testing
2. small closed lecturer pilot
3. limited module-level pilot
4. feedback, security review, and workflow refinement
5. wider departmental pilot
6. institutional readiness review

This staged approach is more realistic and safer. It gives time to validate security, usability, fairness, monitoring, and support processes before wider use.

## Summary

GradeAI's security model is based on controlled access, human review, database-level permissions, careful handling of academic records, and clear separation between AI support and final academic judgement.

The core principle is simple: AI can help lecturers work faster and notice important signals earlier, but sensitive academic decisions must remain reviewable, explainable, and controlled by authorised humans.
