# GradeAI

[![CI](https://github.com/Farukhsb/edu-intel-spark/actions/workflows/ci.yml/badge.svg)](https://github.com/Farukhsb/edu-intel-spark/actions/workflows/ci.yml)

GradeAI is an academic intelligence platform built primarily to help lecturers and institutions identify students who may need support earlier, before poor performance turns into repeated failure, disengagement, or withdrawal.

AI-assisted marking is included because assessment data is one of the clearest ways to understand where students are struggling. By keeping marking, feedback, analytics, intervention tracking, and student support in one place, GradeAI makes it easier for lecturers to review student progress and act early.

The aim is not to replace academic judgement. It is to give lecturers clearer evidence, reduce repetitive marking work, and make student-support decisions easier to review.

The system breaks assessment and support into structured steps:
- rubric-based scoring
- evidence-backed feedback
- integrity signals
- lecturer review before approval and release
- risk indicators and intervention tracking
- student improvement support after feedback is released

This repository uses GitHub Actions CI to run automated checks before changes are merged.

Live deployment:
- `https://gradeai.pages.dev`

The project is designed around the full assessment and student-support workflow rather than a single AI scoring feature. A lecturer can move from assignment setup to grading, moderation, release, cohort-level review, and intervention tracking while keeping each step structured and inspectable.

## Why We Built It

The central problem GradeAI addresses is that struggling students are often identified too late.

In many cases, the warning signs are already present: missed submissions, declining marks, repeated weaknesses against rubric criteria, poor completion patterns, or low engagement. However, these signals are often scattered across different systems or only reviewed after a student has already failed.

Marking is part of this problem because assessment produces the evidence lecturers need to understand student progress. But in traditional workflows, marking, feedback, analytics, and intervention records are often disconnected. That makes it harder to move from “this student performed poorly” to “this student needs timely support.”

GradeAI brings these pieces together. AI-assisted marking is used to reduce repetitive work and structure feedback, while analytics and intervention tools help lecturers identify students who may be falling behind. The platform is designed to support human judgement, not replace it.

This makes GradeAI more than an AI marker. It is a student support and retention system that uses assessment workflows as the foundation for earlier, evidence-informed intervention.

## What Makes GradeAI Different

GradeAI turns assessment data into early support action by showing who may be at risk, why they may be at risk, and what lecturers can do next.

The platform does not stop at dashboards. It connects risk signals to practical workflows such as reviewing at-risk students, opening student plans, contacting students, creating interventions, reviewing weak rubric areas, and clearing feedback bottlenecks.

This creates a clearer chain from assessment evidence to lecturer action:

```text
assessment evidence
  -> support signal
  -> explanation
  -> recommended action
  -> intervention / follow-up
```

## How It Works

At a high level:

```text
submission
  -> extraction
  -> rubric-based grading
  -> validation and fairness checks
  -> lecturer review
  -> approval
  -> release
  -> analytics and student-support signals
  -> intervention / follow-up where needed
```

The same principle applies to integrity review. Similarity signals, structural document artefacts, and AI-writing indicators are separated so the output is easier to interpret.

For student support, GradeAI turns assessment activity into early-warning context. It does not make final decisions about students. Instead, it highlights patterns for lecturer review and supports structured intervention records.

## Platform Preview

Here are a few views from the current product.

### Lecturer overview

![Lecturer dashboard overview](docs/screenshots/lecturer-dashboard-overview.jpg)

### Analytics and insight

![Cohort analytics dashboard](docs/screenshots/cohort-analytics-dashboard.jpg)

![Grade distribution analytics](docs/screenshots/grade-distribution-analytics.jpg)

### Student support and explainability

![Student improvement plan](docs/screenshots/student-improvement-plan.jpg)

![AI grade explanation](docs/screenshots/ai-grade-explanation.jpg)

## Key Features

- early identification of struggling students through risk signals and intervention logging
- explainable support signals with recommended lecturer actions
- cohort analytics and explainable recommendations for lecturer review
- student-facing feedback, improvement plans, and AI tutoring
- rubric-based assignment authoring
- student submission and secure file access
- AI-assisted grading with criterion-level scoring and confidence signals
- lecturer review, approval, and release controls
- citation-aware academic integrity analysis
- moderation workflows with audit history

In practice, a lecturer can move from creating an assignment to grading, moderation, release, cohort-level reflection, and student-support follow-up without leaving the platform. The assessment workflow is included because it creates the structured evidence needed to identify students who may be at risk.

## Workflow Snapshot

Main grading lifecycle:

```text
submitted
  -> ai_grading
  -> ai_graded
  -> first_review / under_review
  -> approved
  -> released
```

Moderated work can move through:

```text
first_review
  -> moderation_pending
  -> moderation_in_progress
  -> moderated / escalated
  -> approved
  -> released
```

This means:
- students never see provisional AI output
- lecturer review remains the decision point before approval
- moderated work is gated before release
- release is still an explicit action
- released feedback can feed into student-support and improvement-plan workflows

## Key Product Areas

### Lecturer workspace

Lecturers can:
- identify students who may be struggling and log intervention or follow-up actions
- review why a student, module, or assessment has been flagged
- move from support signal to action through student plans, contact routes, and intervention workflows
- review cohort analytics and recommendations
- create assignments with weighted rubrics
- upload or review submissions
- run AI grading and integrity checks
- edit marks and feedback before approval
- manage moderation cases

### Student workspace

Students can:
- submit work for open assignments
- view only released grades
- read lecturer-approved feedback
- use the Socratic AI tutor to understand their performance
- track improvement-plan progress

### Institutional workflows

GradeAI also supports:
- student support evidence for retention, progression, and early intervention review
- an admin control surface for user oversight and system-level reporting
- accreditation reporting views
- external examiner export workflows
- moderation and audit trails
- cohort-level quality and performance insight

## Student Support And Retention

One of GradeAI’s core purposes is to help staff support struggling students before they fail a module, disengage from learning, or drop out.

The platform uses assessment and engagement signals to highlight students who may need attention. These can include missed or late submissions, falling marks, repeated weaknesses against rubric criteria, low completion patterns, or other signs that a student may be falling behind.

These signals are not treated as final judgements. They are prompts for lecturers or support teams to review the student’s situation and decide whether an intervention is needed. This keeps human judgement at the centre while making it harder for struggling students to be missed.

Lecturers can record intervention notes, assign priority levels, set follow-up dates, and track progress over time. This creates a clearer support history and helps show what action was taken, when it happened, and whether the student’s situation improved.

AI-assisted marking supports this purpose by making assessment evidence easier to generate, review, and connect to support actions. The marking feature is therefore part of the wider student-support workflow, not the whole product.

This student-support layer is important because assessment data is often one of the earliest indicators that a student is under pressure. GradeAI is designed to turn those signals into timely, practical support rather than waiting until failure or withdrawal has already happened.

## Integrity And Moderation

### Citation-aware integrity review

The integrity layer no longer treats all matched text equally.

It distinguishes between:
- cited overlap
- uncited overlap
- reference sections

Reference sections such as `References`, `Bibliography`, and `Works Cited` are excluded from scoring. Quoted or cited material is still shown to lecturers, but it is labelled as lower-risk cited material rather than treated the same way as uncited copying.

Overlap is split into:
- `total_overlap`
- `cited_overlap`
- `uncited_overlap`
- `internal_peer_overlap`
- `external_source_overlap`

### PDF extraction quality

The integrity pipeline checks extraction quality before similarity analysis. If a PDF is dominated by object streams, metadata, or unreadable artefacts, the result is marked as **analysis limited** instead of being presented as a normal low-risk result.

### Moderation

Moderation is additive to grading, not a replacement for it. The platform supports:
- moderation case creation
- moderator assignment
- agree, adjust, return, escalate, and approve actions
- final agreed score recording
- audit history for grade changes and moderation decisions

## Trust, Safety, And Governance Controls

GradeAI treats academic workflow safety as a product requirement, not just a user-interface concern.

Current safeguards include:
- student-facing grade explanations only use released submissions
- provisional or approved-but-unreleased grading data is not shown to students
- external examiner export workflows exclude draft and unreleased records
- student profile views include data-boundary tests to reduce the risk of showing another student’s information
- application-level error boundaries show safe fallback messages rather than raw runtime error details
- network and API failure paths are tested so failed requests do not leave users with misleading or stale academic data

These controls are designed to keep lecturer judgement, student visibility, moderation, and external review aligned with the assessment lifecycle.

## Cohort Analytics

The analytics layer includes:
- student risk clustering
- performance trends
- grade distribution
- assignment comparison
- integrity signal monitoring

It also includes deterministic AI Recommendations for lecturers. These are explainable rule-based cards derived from analytics data, not black-box predictions.

Examples include:
- high-risk student clusters
- significant score drop between assignments
- weak rubric criteria
- low cohort average
- high failure rate
- integrity spikes

The intention is to support lecturer judgement with signals and context, not to hide decisions behind opaque scoring.

This analytics layer supports early intervention. When patterns suggest that individual students or groups may be struggling, lecturers can use those signals to review the situation and take action before students fail, disengage, or withdraw.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui, lucide-react |
| Backend | Supabase |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Server logic | Supabase Edge Functions |
| Charts | Recharts |
| Product analytics | PostHog |
| Error monitoring | Sentry |
| Hosting | Cloudflare Pages |
| Testing | Vitest, Testing Library, Playwright |

## Production Readiness

GradeAI is not presented as a finished institution-wide platform. It is a working prototype with several hardened workflows and a clear plan for responsible pilot use.

Production-readiness work currently includes:
- privacy-safe Sentry error monitoring and alerting for frontend failures
- automated test coverage for lecturer overview, student explanation, student profile, external examiner export, error boundary handling, and network/API failure states
- student visibility controls that restrict student-facing grade explanations to released submissions
- governed export filtering for external examiner workflows
- safe application fallback behaviour that avoids exposing raw runtime error details to users
- test coverage targets focused on high-risk academic workflows
- a plain-English security model covering roles, RLS assumptions, data handling, AI safety, logging, and rollout risks
- a staged rollout plan that avoids claiming institutional scale too early

Supporting documents:
- [Security Model](docs/SECURITY_MODEL.md)
- [Test Coverage Strategy](docs/TEST_COVERAGE_STRATEGY.md)
- [Rollout Plan](docs/ROLLOUT_PLAN.md)

The purpose of these documents is to make the project easier to review, safer to pilot, and more honest about what still needs to be validated before wider use.

## Technical Summary

For a short one-page technical overview, see [TECHNICAL_SUMMARY.md](TECHNICAL_SUMMARY.md).

## Project Structure

```text
src/
  components/         Shared application components
  components/ui/      UI primitives
  contexts/           App-level state and auth
  integrations/       Supabase client and generated types
  lib/                Shared workflow, analytics, and persistence logic
  pages/
    dashboard/        Lecturer and student dashboard pages
  test/               Unit and integration tests

tests/
  e2e/                Playwright browser coverage

supabase/
  functions/          Edge Functions for grading, integrity, and tutoring
  migrations/         Database schema and policy history
```

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a local `.env` file with your Supabase project values:

```env
VITE_SUPABASE_PROJECT_ID="your_project_ref"
VITE_SUPABASE_PUBLISHABLE_KEY="your_publishable_key"
VITE_SUPABASE_URL="https://your_project_ref.supabase.co"
VITE_SENTRY_DSN="your_sentry_dsn"
VITE_APP_ENV="development"
```

Do not commit local environment files.

### 3. Start the app

```bash
npm run dev
```

If you have pulled recent workflow-notification changes, apply the latest Supabase migrations before testing the notification bell locally. The bell now depends on database support as well as frontend code.

If you have pulled the newer assignment-targeting work, apply the latest assignment migrations before testing assignment visibility, publishing, or student grades. The recent changes add persisted cohort and department targeting, lecturer archive behaviour, and a student-grade metadata RPC. If those migrations are only partially applied, you can end up with missing assignment titles, broken assignment loading, or visibility rules that look inconsistent.

## Testing

Run unit and integration tests:

```bash
npm run test
```

Run coverage reporting:

```bash
npm run test:coverage
```

Run a production build check:

```bash
npm run build
```

Run Playwright browser tests:

```bash
npx playwright install
npm run test:e2e
```

Current automated coverage includes:
- lecturer overview dashboard states
- student-facing grade explanation and released-only visibility
- student profile, support signals, intervention history, and route-mismatch protection
- external examiner export preview, download path, and governed-record filtering
- application error boundary fallback behaviour
- network/API failure paths with safe fallback behaviour

Current browser-level coverage includes:
- lecturer review -> approve -> release
- moderation gating before approval
- student visibility boundaries for approved vs released grades
- academic integrity smoke flow for reviewing and saving a decision

Live browser verification has also been completed on the deployed environment for the core lecturer and student flows, so the current branch is no longer relying only on local or mocked confidence.

## Operational Checklists

For final verification and presentation readiness, use:
- [Release Readiness Checklist](docs/RELEASE_READINESS_CHECKLIST.md)
- [Live Role-Boundary Smoke Checklist](docs/LIVE_ROLE_BOUNDARY_SMOKE.md)

## Supabase And Migrations

This repo expects schema, policy, and RPC changes to be tracked in `supabase/migrations/`.

If you pull new schema changes, apply them manually against the linked project:

```bash
npx supabase db push --linked --include-all
```

Or run the relevant SQL migrations in Supabase SQL Editor.

High-trust workflows in this repo depend on the database layer, not just the UI. That includes:
- RLS policies
- recommendation action RPCs
- moderation tables
- audit logging triggers
- integrity review constraints

That also includes the in-app workflow notifications. The existing `communication_messages` table now carries bell state such as:
- workflow notification categories
- `read`
- `cleared`
- update policies that let the right user mark a notification as read or clear it without deleting history

Recent assignment visibility work also depends on a small chain of related migrations. They should be applied together rather than one by one in isolation:
- `20260428103000_add_assignment_cohort_targeting.sql`
- `20260428113000_restrict_student_assignment_access_to_targeted_cohorts.sql`
- `20260428123000_add_assignment_department_targeting.sql`
- `20260428143000_fix_assignment_targeting_rls_recursion.sql`
- `20260428150000_add_student_grade_assignment_metadata_rpc.sql`
- `20260428153000_fix_student_grade_metadata_rpc_assignment_id_cast.sql`

These migrations do three connected things:
- persist assignment cohort and department targeting
- enforce student assignment visibility and submission access through targeting-aware RLS
- provide the safe student-grade assignment metadata lookup used by `StudentGrades`

If you only apply part of that chain, the app may still build, but assignment pages can fail to load or student grade cards can fall back to `Assignment title unavailable`.

If the app layer and database layer drift apart, the trust boundary becomes weaker quickly. That is why schema, policies, and workflow RPCs are treated as part of the product, not just backend plumbing.

## Migration History Note

This project contains two legacy short-form migration versions in Supabase metadata:

- 20260412
- 20260413

These correspond to:

- 20260412_fix_multi_tenant_rls.sql
- 20260413_create_student_interventions.sql

All migrations have been successfully applied in the live project, and the database is functioning correctly.

However, Supabase CLI may display these entries as “unmatched” due to earlier naming inconsistencies in migration IDs. This is a metadata alignment issue in the migration history, not a schema or permissions failure.

Important:
- do not rename or modify historical migration IDs on a live project without a deliberate migration-history reconciliation plan
- treat this as a migration ledger hygiene issue only

No action is required for normal operation.

### Current role-model note

The role model is clearer than it was earlier in the project, but it is still worth calling out.

- `admin` is now part of the database role model
- public signup is hardened so it cannot create admin users
- the app is moving toward `user_roles` as the real authorization source, with `profiles.role` still mirrored for compatibility in some UI paths

So if you touch auth, routing, Edge Function checks, or RLS, check the full role path end to end rather than assuming the frontend alone tells the whole story.

## Important Edge Functions

The current backend uses these Supabase Edge Functions:
- `grade-submission`
- `check-plagiarism`
- `explain-grade`
- `bulk-create-students`
- `send-workflow-notification-email`

## Deployment Notes

- Frontend deploys to Cloudflare Pages
- Backend services run through Supabase
- Environment variables and Supabase secrets must match the target environment
- Sentry should be configured through environment variables, not hardcoded in source files
- workflow email notifications require the `send-workflow-notification-email` Edge Function plus email secrets
- Edge Functions should be deployed when function code changes:

```bash
npx supabase functions deploy grade-submission
npx supabase functions deploy check-plagiarism
npx supabase functions deploy send-workflow-notification-email
```

For workflow email notifications, the following Supabase secrets are required:

```bash
EMAIL_NOTIFICATIONS_ENABLED=true
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM_ADDRESS="GradeAI <notifications@yourdomain.com>"
APP_BASE_URL="https://your-app-url"
```

Current email-backed workflow events are:
- `assignment-published`
- `submission-received`
- `grade-released`

The bell notification remains the primary in-app record. Email delivery is a non-blocking mirror of those safe workflow events.

## Assignment Targeting

Assignments can now be targeted to:
- one or more cohorts
- one or more departments

Student access is intentionally strict:
- students only see published assignments that match the stored targeting rules
- if both cohort and department targeting are set, the student must match both
- if an assignment has no stored cohort or department target, students do not see it by default

This is deliberate. The app no longer guesses assignment visibility from UI state alone.

## Lecturer Assignment Management

The lecturer assignment page now treats `closed` as an archive state:
- active assignments stay in the default view
- archived assignments are still searchable and recoverable
- restore sends an archived assignment back to `draft`

This keeps old assignments available without leaving them in the lecturer’s face every time they open the page.

## Student Grade Titles

Student grade cards now resolve assignment titles through a student-scoped metadata RPC instead of broad assignment reads.

That means:
- released grades can still be shown safely
- students do not regain broad access to all assignments
- if assignment metadata is genuinely unavailable, the UI falls back safely instead of crashing

## Recent Hardening (April 2026)

- AI response validation using Zod
- Rate limiting for high-cost Edge Functions
- Environment variable validation
- Structured logging with sanitisation
- Error boundary and network failure handling
- Persisted in-app workflow notifications with bell clearing
- Expanded test coverage across critical workflows

## Recent Improvements

A few areas of the platform were tightened recently to make the product more reliable in day-to-day use.

- production-readiness documentation was added for security, testing, rollout planning, and monitoring
- privacy-safe Sentry monitoring and alerting were configured for frontend error visibility
- automated coverage was expanded across lecturer overview, student grade explanation, student profile, external examiner export, error boundary handling, and network failure paths
- student-facing grade explanations were tightened so they only use released submissions
- external examiner export filtering was tightened so draft or unreleased records are excluded from governance workflows
- the application error boundary was updated so users see safe fallback messaging rather than raw runtime errors
- the product positioning was clarified around early student support and retention, with AI marking framed as one component of a wider intervention workflow
- the documentation now highlights the full action chain from assessment evidence to support signal, explanation, recommended action, and intervention follow-up
- moderation permissions were aligned between local and hosted policy state, and the moderation workflow was rechecked against the current migration chain
- moderation UI coverage now includes nullable fallback cases, so missing linked submission data is handled explicitly and tested
- route-level lazy loading was improved to reduce the main frontend bundle
- export and chart-heavy vendor buckets were split more conservatively, so those libraries load closer to the routes and actions that use them
- React Router future flags were enabled early to reduce upgrade warnings and keep the app closer to upcoming router behaviour
- the role model was tightened so admin is part of the real schema, generated types were brought back in line, and public signup no longer trusts admin role input
- the admin area now includes read-only oversight views for users, assignments, submissions, reporting, and system-level navigation without forcing admin through lecturer-heavy pages
- performance trend wording was softened so student support signals are presented as lecturer review prompts rather than automated judgements

## Current State

This project is best described as a fast-moving integrated prototype with hardened core workflows. It is no longer just a UI demo, but it is also not pretending to be a finished institutional platform.

The strongest areas are:
- early student support and intervention tracking
- explainable support signals and recommended actions
- coherent assessment workflow design
- lecturer oversight and explainability
- moderation and audit direction
- integrity pipeline improvements
- student visibility controls around released feedback
- governed external examiner export filtering
- safe error-boundary and network-failure fallback behaviour
- early support and student intervention design
- growing automated coverage around critical flows
- live verification of core deployed workflows
- production-readiness planning through monitoring, security, testing, and rollout documentation

The main work still worth doing is operational hardening:
- more live-environment verification
- broader permissions and RLS validation after migration changes
- stricter TypeScript coverage and reduced `any` usage
- API/AI response validation using schemas such as Zod
- structured logging for production debugging and audit trails
- continued extraction of heavy page logic into smaller domain services
