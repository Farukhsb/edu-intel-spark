# GradeAI

[![CI](https://github.com/Farukhsb/edu-intel-spark/actions/workflows/ci.yml/badge.svg)](https://github.com/Farukhsb/edu-intel-spark/actions/workflows/ci.yml)

GradeAI is a full-stack academic workflow platform for higher education. It helps lecturers manage assessment, AI-assisted grading, academic integrity review, moderation, feedback release, cohort analytics, and early student-support intervention in one connected system.

The platform is built around a simple principle: AI can help prepare evidence, feedback, and support signals, but academic judgement stays with lecturers.

GradeAI is not intended to be a black-box auto-grading tool. It is designed to make assessment workflows easier to review, easier to moderate, and easier to connect to student support.

- Live deployment: `https://gradeai.pages.dev`
- Repository: `https://github.com/Farukhsb/edu-intel-spark`

## Why This Exists

Struggling students are often identified too late. The warning signs may already be there: missed submissions, falling marks, repeated weaknesses against rubric criteria, poor completion patterns, or low engagement. In many institutions, those signals sit across different systems and are only reviewed after a student has already failed, disengaged, or withdrawn.

Assessment is central to this problem because it creates some of the clearest evidence of student progress. But marking, feedback, moderation, academic integrity review, analytics, and intervention records are often disconnected.

GradeAI brings these parts together. It uses AI-assisted marking to reduce repetitive work and structure feedback, while analytics and intervention tools help lecturers act earlier. The aim is not to automate academic judgement. The aim is to give lecturers clearer evidence and a more connected workflow.

## What GradeAI Does

### Assessment and grading

- create assignments with weighted rubrics
- collect and review student submissions
- run AI-assisted grading through backend Edge Functions
- return criterion-level feedback, scores, evidence, and confidence signals
- keep lecturer review as the decision point before approval and release

### Academic integrity and moderation

- review similarity and integrity signals
- separate cited, uncited, internal, and external overlap
- identify cases where extraction quality limits the analysis
- support moderation cases where work needs a second review
- record moderation actions and audit history

### Student support

- identify students who may need support earlier
- show explainable risk indicators
- support intervention notes and follow-up actions
- give students released feedback and improvement guidance
- keep provisional AI output away from students until work is approved and released

### Analytics

- cohort analytics
- grade distribution
- assignment comparison
- performance trends
- integrity signal monitoring
- rule-based recommendations for lecturer review

### Notifications

- in-app workflow notifications
- email notification backend for assignment, submission, and grade-release events
- email delivery is feature-flagged and pending verified sender/API key setup before full live validation

## How The Workflow Fits Together

```text
submission
  -> document extraction
  -> rubric-based AI grading
  -> lecturer review
  -> moderation if required
  -> approval
  -> release
  -> student explanation
  -> analytics and support signals
  -> intervention / follow-up
```

The important point is that AI output is not treated as the final academic decision. A lecturer reviews the result before it is approved or released. Students only see feedback after it has passed through the release workflow.

For student support, GradeAI turns assessment activity into early-warning context. It highlights patterns for lecturer review and supports structured intervention records, rather than making automatic decisions about students.

## Platform Preview

### Lecturer overview

![Lecturer dashboard overview](docs/screenshots/lecturer-dashboard-overview.jpg)

### Analytics and insight

![Cohort analytics dashboard](docs/screenshots/cohort-analytics-dashboard.jpg)

![Grade distribution analytics](docs/screenshots/grade-distribution-analytics.jpg)

### Student support and explainability

![Student improvement plan](docs/screenshots/student-improvement-plan.jpg)

![AI grade explanation](docs/screenshots/ai-grade-explanation.jpg)

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

GradeAI is a working full-stack prototype with several hardened workflows. It is not presented as a finished institution-wide platform. The current focus is making the core assessment, review, moderation, analytics, and support workflows reliable enough for controlled testing and further development.

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

## Recent Hardening

Recent backend and workflow hardening included:

- tightened no-Origin CORS behaviour for Edge Functions
- fixed the lint gate and ignored generated coverage output during lint
- verified service-role/auth boundaries across sensitive Edge Functions
- confirmed no committed real secrets were found during audit
- validated the project with `npm run lint`, `npm run test`, and `npm run build`
- redeployed affected Edge Functions after shared backend code changes
- added safer handling around notification and workflow paths

## Documentation

Supporting documentation:

- [Technical Summary](TECHNICAL_SUMMARY.md)
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

### Migration history note

This project contains two legacy short-form migration versions in Supabase metadata:

- `20260412`
- `20260413`

These correspond to:

- `20260412_fix_multi_tenant_rls.sql`
- `20260413_create_student_interventions.sql`

Supabase CLI may display these entries as unmatched because of earlier naming inconsistencies in migration IDs. This is a migration ledger hygiene issue, not a schema or permissions failure. Do not rename or modify historical migration IDs on a live project without a deliberate reconciliation plan.

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

The bell notification remains the primary in-app record. Email delivery is a non-blocking mirror of selected workflow events.
