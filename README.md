# GradeAI

[![CI](https://github.com/Farukhsb/edu-intel-spark/actions/workflows/ci.yml/badge.svg)](https://github.com/Farukhsb/edu-intel-spark/actions/workflows/ci.yml)

GradeAI is an academic risk intelligence platform for higher education. It helps lecturers and institutions surface academic risk earlier by turning assessment activity, grading signals, integrity review, moderation, feedback release, cohort analytics, and intervention workflows into one connected picture.

The platform is built on a simple premise: academic risk is easier to understand when assessment, feedback, integrity signals, and support actions are connected instead of scattered across separate tools. AI helps prepare evidence, summaries, and draft grading output, while academic judgement stays firmly with lecturers.

GradeAI is not a black-box auto-grading tool. It is designed to help educators see problems earlier, understand what is driving them, and act with more confidence through reviewable, evidence-led workflows.

## Core Loop

```text
student submits work
  -> assessment signals are extracted
  -> academic risk is identified
  -> lecturer reviews the evidence
  -> intervention or moderation action is taken
  -> student progress is tracked over time
```

This is the product loop GradeAI is built around: assessment evidence becomes risk intelligence, and risk intelligence becomes timely lecturer-led action.

## Why This Exists

Struggling students are often identified too late. The warning signs may already be there: missed submissions, falling marks, repeated weaknesses against rubric criteria, poor completion patterns, or low engagement. In many institutions, those signals sit across different systems and are only reviewed after a student has already failed, disengaged, or withdrawn.

Assessment is central to this problem because it creates some of the clearest evidence of student progress. But marking, feedback, moderation, academic integrity review, analytics, and intervention records are often disconnected.

GradeAI brings these parts together. The aim is not to automate academic judgement. The aim is to give lecturers clearer evidence and a more connected workflow for earlier support.

## Academic Risk Intelligence

GradeAI treats academic risk as something institutions should be able to see early, not something they only discover once final outcomes are already locked in.

Instead of waiting for end-of-term results, it reads day-to-day academic workflow data such as missing submissions, weak rubric performance, integrity concerns, repeated feedback patterns, release status, and cohort-level shifts to highlight where attention may be needed sooner.

The goal is to help lecturers answer practical questions earlier:

- Which students are showing early signs of academic risk?
- Which assignments are generating weak outcomes or integrity concerns?
- Which feedback patterns suggest recurring misunderstanding?
- Which cases need moderation, review, or follow-up support?

That makes GradeAI less about isolated grading automation and more about giving lecturers a live view of what is working, what is starting to drift, and where timely support could make the biggest difference.

## What GradeAI Does

### Risk signal generation

- brings together assignment, submission, grading, integrity, moderation, and intervention data
- highlights academic risk indicators from live workflow activity
- shows where weak performance, missing work, or repeated issues are starting to build
- supports earlier lecturer review before risk turns into failure, disengagement, or withdrawal

### Assessment intelligence

- create assignments with weighted rubrics
- collect and review student submissions
- run AI-assisted grading through backend Edge Functions
- return criterion-level feedback, scores, evidence, and confidence signals
- keep lecturer review at the centre before approval and release

### Academic integrity and moderation

- review similarity and integrity signals
- separate cited, uncited, internal, and external overlap
- identify cases where extraction quality limits the analysis
- support moderation cases where work needs a second review
- record moderation actions and audit history

### Student support and intervention

- identify students who may need support earlier
- support intervention notes and follow-up actions
- give students released feedback and improvement guidance
- keep provisional AI output away from students until work is approved and released
- connect assessment evidence to practical lecturer follow-up

### Analytics and oversight

- cohort analytics
- grade distribution
- assignment comparison
- performance trends
- integrity signal monitoring
- rule-based recommendations for lecturer review

### Workflow notifications

- in-app workflow notifications
- email notification backend for assignment, submission, and grade-release events
- email delivery is feature-flagged and remains optional until sender and provider setup are ready

## How The Workflow Fits Together

```text
submission
  -> assessment evidence
  -> document extraction
  -> AI-assisted grading
  -> integrity and confidence signals
  -> lecturer review
  -> moderation if required
  -> approval
  -> release
  -> student explanation and feedback
  -> analytics and academic risk intelligence
  -> intervention / follow-up
```

AI output is not treated as the final academic decision. Students only see feedback after it has passed through the lecturer review and release workflow.

## Platform Preview

### Lecturer overview

![Lecturer dashboard overview](docs/screenshots/lecturer-dashboard-overview.jpg)

### Analytics and insight

![Cohort analytics dashboard](docs/screenshots/cohort-analytics-dashboard.jpg)

![Grade distribution analytics](docs/screenshots/grade-distribution-analytics.jpg)

### Student support and explainability

![Student improvement plan](docs/screenshots/student-improvement-plan.jpg)

![AI grade explanation](docs/screenshots/ai-grade-explanation.jpg)

## Demo Mode

GradeAI includes a synthetic demo mode for reviewer walkthroughs and product evaluation.

Demo mode:

- uses fabricated assignments, rubrics, submissions, grades, integrity examples, and feedback
- does not rely on live academic records for demo assignment-set workflows
- keeps demo assignment, submission, grading, and feedback paths isolated from real Supabase academic data

Reusable synthetic assignment sets are used to demonstrate assignment briefs, rubric setup, AI-facing grading context, sample feedback, integrity review, and moderation examples.

For real lecturers, sample assignment templates can prefill the assignment form, but they do not auto-create submissions, grades, integrity cases, or moderation records.

## Key Product Areas

### Lecturer workspace

Lecturers can identify students who may be struggling, review why a student or assessment has been flagged, create assignments, run AI-assisted grading and integrity checks, edit marks and feedback, manage moderation cases, and record intervention or follow-up actions.

### Student workspace

Students can submit work for open assignments, view released grades, read lecturer-approved feedback, use support tools to understand their performance, and track improvement-plan progress.

### Institutional workflows

GradeAI also supports admin oversight, accreditation-style reporting, external examiner export workflows, moderation history, audit trails, and cohort-level performance insight.

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui, Radix UI, lucide-react |
| Backend | Supabase |
| Auth | Supabase Auth |
| Database | Postgres with Row-Level Security |
| Storage | Supabase Storage |
| Server logic | Supabase Edge Functions |
| Charts | Recharts |
| Product analytics | PostHog |
| Error monitoring | Sentry |
| Hosting | Cloudflare Pages |
| Testing | Vitest, Testing Library, Playwright |
| CI | GitHub Actions |

Important Edge Functions:

- `grade-submission`
- `check-plagiarism`
- `explain-grade`
- `bulk-create-students`
- `send-workflow-notification-email`

## Key Engineering Decisions

A few decisions shape how the platform works:

- AI output is treated as draft support, not a final academic decision.
- Students only see feedback after it has been approved and released.
- Lecturer review remains central to grading, moderation, and integrity workflows.
- Backend Edge Functions validate requests and check the authenticated user before sensitive operations.
- Service-role access is limited to server-side functions with role and ownership checks.
- Risk signals are explainable prompts for lecturer review, not automatic judgements about students.
- Email notifications are controlled by feature flags and Supabase secrets so delivery can stay disabled until provider setup is complete.
- Schema, RLS policies, workflow RPCs, and migrations are treated as part of the product, not just backend plumbing.

## Trust, Safety, And Governance Controls

GradeAI treats academic workflow safety as a product requirement, not just a user-interface concern.

Current safeguards include:

- student-facing grade explanations only use released submissions
- provisional or approved-but-unreleased grading data is not shown to students
- external examiner export workflows exclude draft and unreleased records
- student profile views include data-boundary tests to reduce the risk of showing another student's information
- application-level error boundaries show safe fallback messages rather than raw runtime error details
- network and API failure paths are tested so failed requests do not leave users with misleading or stale academic data
- integrity signals are presented as evidence for review, not proof of misconduct
- risk indicators are presented as lecturer review prompts, not automated judgements

## Current State

GradeAI is a working full-stack prototype with hardened core workflows. It is no longer just a UI demo, but it is not presented as a finished institution-wide platform. The current focus is making the assessment, review, moderation, analytics, and support workflows reliable enough for controlled testing and further development.

The backend is now running against a clean Supabase project with RLS, API grants, storage, Edge Functions, and AI secrets reconfigured under the controlled project setup.

Working well:

- core assignment and submission workflow
- AI-assisted grading pipeline
- lecturer review, approval, and release flow
- student-facing released feedback
- moderation workflow direction
- citation-aware integrity review direction
- cohort analytics and early support signals
- GitHub Actions CI, tests, and build checks
- backend hardening around CORS, lint, service-role usage, and secrets handling
- production-readiness documentation around security, testing, rollout, and monitoring

Still improving:

- broader live-environment verification
- stronger automated tests for role boundaries and RLS behaviour
- stricter TypeScript coverage
- targeted recipient logic for assignment-published email notifications
- final live email delivery validation after verified sender/API key setup
- continued extraction of large page logic into smaller domain services
- deeper operational logging and audit visibility

## Recent Hardening and Improvements

Recent work has focused on making the product more reliable, safer to test, and easier to operate:

- tightened no-Origin CORS behaviour for Edge Functions
- fixed the lint gate and ignored generated coverage output during lint
- verified service-role/auth boundaries across sensitive Edge Functions
- confirmed no committed real secrets were found during audit
- validated the project with `npm run lint`, `npm run test`, and `npm run build`
- redeployed affected Edge Functions after shared backend code changes
- added safer handling around notification and workflow paths
- expanded automated coverage across lecturer overview, student grade explanation, student profile, external examiner export, error boundary handling, and network failure paths
- tightened student-facing grade explanations so they only use released submissions
- tightened external examiner export filtering so draft or unreleased records are excluded from governance workflows
- clarified product positioning around early student support and academic risk intelligence
- aligned moderation permissions between local and hosted policy state
- improved route-level lazy loading and vendor bundle splitting
- tightened the role model so admin is part of the real schema and public signup no longer trusts admin role input
- added read-only admin oversight views for users, assignments, submissions, reporting, and system-level navigation

## Documentation

Supporting documentation:

- [Technical Summary](TECHNICAL_SUMMARY.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [Security Model](docs/SECURITY_MODEL.md)
- [Test Coverage Strategy](docs/TEST_COVERAGE_STRATEGY.md)
- [Rollout Plan](docs/ROLLOUT_PLAN.md)
- [Release Readiness Checklist](docs/RELEASE_READINESS_CHECKLIST.md)
- [Live Role-Boundary Smoke Checklist](docs/LIVE_ROLE_BOUNDARY_SMOKE.md)

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
  functions/          Edge Functions for grading, integrity, email, and tutoring
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
VITE_ANALYTICS_ENABLED="false"
```

Do not commit local environment files.

### 3. Start the app

```bash
npm run dev
```

If you pull schema or workflow-notification changes, apply the latest Supabase migrations before testing related features locally.

## Testing

Run lint:

```bash
npm run lint
```

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

A useful local quality gate is:

```bash
npm run lint && npm run test && npm run build
```

## Supabase And Migrations

This repo expects schema, policy, and RPC changes to be tracked in `supabase/migrations/`.

If you pull new schema changes, apply them manually against the linked project:

```bash
npx supabase db push --linked --include-all
```

Or run the relevant SQL migrations in the Supabase SQL Editor.

High-trust workflows depend on the database layer, not just the UI. That includes RLS policies, recommendation action RPCs, moderation tables, audit logging triggers, integrity review constraints, and in-app workflow notifications.

Recent assignment visibility work depends on the related targeting migrations being applied together. They persist cohort and department targeting, enforce student assignment visibility through targeting-aware RLS, and provide the safe student-grade assignment metadata lookup used by `StudentGrades`.

If the app layer and database layer drift apart, the trust boundary becomes weaker quickly. Schema, policies, and workflow RPCs are treated as part of the product, not just backend plumbing.

Current high-cost Edge Function rate limiting is process-local and in-memory. That is acceptable for prototype use and controlled pilot testing, but wider rollout should move high-cost AI rate limiting into a persistent/shared store or complement it with provider-level controls.

## Migration History Note

Earlier versions of the project included legacy short-form Supabase migration versions from the Lovable-era setup.

The active deployment target has since been moved to a clean, controlled Supabase project. New migrations should use full 14-digit timestamp prefixes:

```text
YYYYMMDDHHMMSS_description.sql
```

Do not create new short-form migration IDs.

For deployment setup and environment configuration, see the [Deployment Guide](docs/DEPLOYMENT_GUIDE.md).

## Deployment Notes

- Frontend deploys to Cloudflare Pages.
- Backend services run through Supabase.
- Environment variables and Supabase secrets must match the target environment.
- Sentry should be configured through environment variables, not hardcoded in source files.
- Edge Functions should be redeployed when function code or shared function helpers change.

Common Edge Function deployment commands:

```bash
npx supabase functions deploy grade-submission
npx supabase functions deploy check-plagiarism
npx supabase functions deploy explain-grade
npx supabase functions deploy bulk-create-students
npx supabase functions deploy send-workflow-notification-email
```

For workflow email notifications, these Supabase secrets are expected when live email delivery is ready:

```bash
EMAIL_NOTIFICATIONS_ENABLED=true
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM_ADDRESS="GradeAI <notifications@yourdomain.com>"
APP_BASE_URL="https://gradeai.pages.dev"
```

Before sender verification and API key setup are complete, keep email delivery disabled:

```bash
EMAIL_NOTIFICATIONS_ENABLED=false
```

Current email-backed workflow events are:

- `assignment-published`
- `submission-received`
- `grade-released`

The bell notification remains the primary in-app record. Email delivery is a non-blocking mirror of those safe workflow events.

Analytics is disabled by default. If you explicitly enable PostHog for a controlled test, keep it privacy-minimised and avoid sending academic content, names, or email addresses.

## Assignment Targeting

Assignments can now be targeted to one or more cohorts and/or departments.

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

This keeps old assignments available without leaving them in the lecturer's face every time they open the page.

## Student Grade Titles

Student grade cards now resolve assignment titles through a student-scoped metadata RPC instead of broad assignment reads.

That means:

- released grades can still be shown safely
- students do not regain broad access to all assignments
- if assignment metadata is genuinely unavailable, the UI falls back safely instead of crashing
