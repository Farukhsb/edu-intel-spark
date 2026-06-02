# GradeAI

[![CI](https://github.com/Farukhsb/edu-intel-spark/actions/workflows/ci.yml/badge.svg)](https://github.com/Farukhsb/edu-intel-spark/actions/workflows/ci.yml)

GradeAI is an academic risk intelligence platform for higher education and wider education settings. It helps lecturers, teachers, tutors, and institutions surface academic risk earlier by turning assessment activity, grading signals, integrity review, moderation, feedback release, cohort analytics, and intervention workflows into one connected picture.

The platform is built on a simple premise: academic risk is easier to understand when assessment, feedback, integrity signals, and support actions are connected instead of scattered across separate tools. AI helps prepare evidence, summaries, and draft grading output, while academic judgement stays firmly with educators.

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

This is the product loop GradeAI is built around: assessment evidence becomes risk intelligence, and risk intelligence becomes timely educator-led action.

## Why This Exists

Struggling students are often identified too late. The warning signs may already be there: missed submissions, falling marks, repeated weaknesses against rubric criteria, poor completion patterns, or low engagement. In many institutions, those signals sit across different systems and are only reviewed after a student has already failed, disengaged, or withdrawn.

Assessment is central to this problem because it creates some of the clearest evidence of student progress. But marking, feedback, moderation, academic integrity review, analytics, and intervention records are often disconnected.

GradeAI brings these parts together. The aim is not to automate academic judgement. The aim is to give educators clearer evidence and a more connected workflow for earlier support.

## Where GradeAI Fits

GradeAI is built for education workflows where assessment, feedback, moderation, integrity, analytics, and intervention need to sit in one place. It can be used in universities, colleges, training providers, and other settings with similar workflows.

The main idea is simple: keep the institution in control of the data, keep academic judgement with staff, and make the evidence easier to act on.

## What GradeAI Does

### What GradeAI does

- connects assignments, submissions, grading, integrity, moderation, and intervention records
- supports AI-assisted grading, but keeps approval and release with the lecturer
- imports existing grades from CSV or image on the lecturer overview page
- links imported grades back to assignments so analytics update from the same data
- gives admins reporting views for oversight, accreditation, and external examiner export

### Workflow notifications

- in-app workflow notifications
- backend email notification infrastructure exists for assignment, submission, and grade-release events
- live app flows are currently bell-first, with workflow email dispatch disabled until sender and provider setup are intentionally re-enabled

## How The Workflow Fits Together

```text
submission
  -> assessment evidence
  -> document extraction
  -> AI-assisted grading
  -> integrity and confidence signals
  -> educator review
  -> moderation if required
  -> approval
  -> release
  -> student explanation and feedback
  -> analytics and academic risk intelligence
  -> intervention / follow-up
```

AI output is not treated as the final academic decision. Students only see feedback after it has passed through the educator review and release workflow.

Unreadable PDFs can also be routed through an optional Docling fallback in the backend document-extraction flow when the relevant Supabase secrets are configured. That fallback is disabled by default and only applies to PDF extraction.

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

For real lecturers or teachers, sample assignment templates can prefill the assignment form, but they do not auto-create submissions, grades, integrity cases, or moderation records.

## Key Product Areas

### Educator workspace

Educators can identify students who may be struggling, review why a student or assessment has been flagged, create assignments, run AI-assisted grading and integrity checks, edit marks and feedback, manage moderation cases, and record intervention or follow-up actions.

### Student workspace

Students can submit work for open assignments, view released grades, read educator-approved feedback, use support tools to understand their performance, and track improvement-plan progress.

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

### Integrity provider modes

`check-plagiarism` now supports provider-abstracted backend integrity checks:

- `llm_legacy`
- `internal_text_similarity`
- `both` through `INTEGRITY_PROVIDER_MODE`
- optional MOSS code-similarity evidence through the private runner bridge

The lecturer-facing plagiarism workflow still keeps the established response shape, but `internal_text_similarity` is now part of the live backend decision path. It contributes pairwise similarity flags and risk scoring during `check-plagiarism`, and it also writes evidence rows to `public.integrity_findings` for audit and future provider-specific UI work.

GradeAI also includes a working provider-abstracted MOSS integration for code-based assignments. The main app does not call Stanford MOSS directly. Instead, the `check-plagiarism` Edge Function sends eligible code submissions to a separately hosted private MOSS runner over HTTPS using `x-api-key` authentication.

When configured, the MOSS provider:

- only runs for supported code-like file extensions
- sends eligible extracted source text to the private runner
- lets the private runner perform the actual Stanford MOSS submission
- stores code-similarity evidence in `public.integrity_findings` with `provider = 'moss'`
- keeps the existing lecturer plagiarism UI stable
- never blocks or replaces the existing plagiarism response path

This keeps the public GradeAI application separate from the private MOSS execution environment. The Stanford MOSS script, MOSS user ID, runner secrets, and production runner deployment stay outside this public repository.

Required GradeAI-side MOSS bridge secrets:

- `MOSS_PROVIDER_ENABLED=true`
- `MOSS_RUNNER_URL=https://your-runner/run-moss`
- `MOSS_RUNNER_API_SECRET=your_shared_secret`
- optional `MOSS_RUNNER_TIMEOUT_MS`

The production MOSS runner is hosted from a separate private repository. This public repo documents the integration contract and expected environment variables only.

## Legal, Compliance, And Data Handling

GradeAI is built for education data, so the platform keeps academic judgement with staff and keeps the institution in control of its own records. It uses role-based access, RLS, audit-oriented records, and synthetic demo data for walkthroughs.

This repository is still a prototype, not a legal certification or an institutional deployment. A real rollout still needs the usual governance work: notices, lawful basis, retention policy, provider review, and local policy sign-off.

## Key Engineering Decisions

A few decisions shape how the platform works:

- AI output is treated as draft support, not a final academic decision.
- Students only see feedback after it has been approved and released.
- Educator review remains central to grading, moderation, and integrity workflows.
- Backend Edge Functions validate requests and check the authenticated user before sensitive operations.
- Service-role access is limited to server-side functions with role and ownership checks.
- Risk signals are explainable prompts for educator review, not automatic judgements about students.
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
- risk indicators are presented as educator review prompts, not automated judgements

## Current State

GradeAI is a working prototype, not a finished institution-wide product. The core workflow is in place: assignments, submissions, AI-assisted grading, lecturer review, moderation, student feedback release, analytics, admin oversight, and demo mode.

What still depends on environment setup:

- email delivery
- analytics and monitoring
- the optional private MOSS runner
- live AI provider behaviour
- deployment-side governance and policy choices

## Recent Hardening

Recent work has focused on making the app safer to run and easier to reason about:

- better CORS and Edge Function boundaries
- safer failure handling in lecturer and admin report pages
- more coverage around dashboard and workflow regressions
- cleaner role routing and admin oversight
- smaller route chunks and better build output

## Documentation

Supporting documentation:

- [Technical Summary](TECHNICAL_SUMMARY.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [Security Model](docs/SECURITY_MODEL.md)
- [AI Provider And Deployment Strategy](docs/AI_PROVIDER_AND_DEPLOYMENT_STRATEGY.md)
- [Test Coverage Strategy](docs/support/TEST_COVERAGE_STRATEGY.md)
- [Release Readiness Checklist](docs/support/RELEASE_READINESS_CHECKLIST.md)
- [Live Role-Boundary Smoke Checklist](docs/support/LIVE_ROLE_BOUNDARY_SMOKE.md)

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

benchmarks/
  *.json              Saved benchmark snapshots and comparison output

tools/
  grading-benchmark/  Scripts and fixtures for grading benchmark work
  load-test/          Read-heavy load test runner used by `npm run test:load`
  moss-runner/        Private MOSS bridge used by `npm run moss:runner`

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

If you enable the optional Docling fallback, set the backend secrets in Supabase rather than in the frontend `.env` file:

- `DOCLING_EXTRACTION_FALLBACK_ENABLED=true`
- `DOCLING_EXTRACTION_FALLBACK_URL=https://your-docling-service/extract`
- `DOCLING_EXTRACTION_FALLBACK_SECRET=your_shared_secret`
- `DOCLING_EXTRACTION_FALLBACK_TIMEOUT_MS=15000`

### 3. Start the app

```bash
npm run dev
```

When calling Supabase Edge Functions directly from the browser during local development, requests must include both:

- `Authorization: Bearer <session_access_token>`
- `apikey: <VITE_SUPABASE_PUBLISHABLE_KEY>`

Localhost Edge Function CORS now supports any `localhost` or `127.0.0.1` port, so Vite does not need to stay on one fixed port for grading, plagiarism, or grade explanation flows.

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

Run local performance benchmarks:

```bash
npm run test:perf
```

`npm run test:perf` runs the workflow performance spec in `src/test/workflowPerformance.test.ts`. It is a quick local check for regressions in the read-heavy workflow paths, not a full load test.

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
npm run test:e2e:install
npm run test:e2e
```

The CI workflow caches Playwright browsers between runs and installs Chromium with the same command before executing the E2E suite.

Run the live read-heavy load test against a deployed stack:

```bash
npm run test:load
```

The load test is intentionally conservative. It is meant to check read-path latency and access behaviour with scoped pilot accounts, not to simulate destructive grading or integrity writes.

The support scripts for those checks live under `tools/`:

- `tools/load-test/` contains the deployed-stack load runner used by `npm run test:load`
- `tools/grading-benchmark/` holds grading benchmark support files
- `tools/moss-runner/` contains the private MOSS bridge used for the optional code-similarity runner

The `benchmarks/` directory is where saved benchmark snapshots live. At the moment it mainly holds the database normalisation benchmark output kept for reference.

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

Recent assignment visibility work depends on the related targeting migrations being applied together. Those migrations do three connected things:
- persist assignment cohort and department targeting
- enforce student assignment visibility and submission access through targeting-aware RLS
- provide the safe student-grade assignment metadata lookup used by `StudentGrades`

If you only apply part of that chain, the app may still build, but assignment pages can fail to load or student grade cards can fall back to `Assignment title unavailable`.

The integrity pipeline also depends on these newer migrations being present together:

- `20260501170444_add_integrity_findings_table.sql`
- `20260501181500_grant_service_role_delete_on_integrity_findings.sql`
- `20260501190500_grant_service_role_select_on_assignments.sql`
- `20260501195500_fix_integrity_persistence_permissions_and_dedupe.sql`

Those migrations do four connected things:

- create `public.integrity_findings`
- allow safe refresh of `internal_text_similarity` evidence rows
- close service-role permission gaps discovered during live grading and plagiarism checks
- dedupe and stabilise repeated integrity evidence writes across reruns

The current grading and notification hardening also depends on these newer migrations:

- `20260508004500_fix_submission_targeting_policy_private_helper.sql`
- `20260508011500_fix_lecturer_submission_update_policy.sql`
- `20260508013000_fix_communication_message_update_policy.sql`
- `20260508020000_reset_communication_message_policies.sql`

Those migrations do four connected things:

- repair targeted submission access to use the private helper boundary correctly
- restore lecturer submission updates needed for grading-state transitions
- remove recursive `communication_messages` policy behavior
- stabilise bell-notification clear/update paths under RLS

If the app layer and database layer drift apart, the trust boundary becomes weaker quickly. That is why schema, policies, and workflow RPCs are treated as part of the product, not just backend plumbing.

Current high-cost Edge Function rate limiting is process-local and in-memory. That is acceptable for prototype use and controlled pilot testing, but it is not distributed production-grade protection yet. Wider rollout should move high-cost AI rate limiting into a persistent/shared store or complement it with provider-level controls.

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

For workflow email notifications, these Supabase secrets are expected when live email delivery is intentionally re-enabled:

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

The backend is prepared for these workflow email categories:

- `assignment-published`
- `submission-received`
- `grade-released`

The bell notification is the active workflow record. Email delivery should only be turned back on as an optional non-blocking mirror after provider, sender, and recipient-flow validation are complete.

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
