# GradeAI

[![CI](https://github.com/Farukhsb/edu-intel-spark/actions/workflows/ci.yml/badge.svg)](https://github.com/Farukhsb/edu-intel-spark/actions/workflows/ci.yml)
[![coverage](https://codecov.io/gh/Farukhsb/edu-intel-spark/branch/main/graph/badge.svg)](https://codecov.io/gh/Farukhsb/edu-intel-spark)

GradeAI is a controlled-pilot academic workflow platform for assessment, moderation, student support, risk review, and evidence export. It helps institutions spot students at risk earlier so staff can intervene sooner.

It sits alongside existing systems and uses machine learning to track grades, submissions, and engagement over time. GradeAI is not a replacement for the LMS or for academic judgement.

## Current Status

GradeAI is implemented, but still a pilot rather than a finished institution-wide product.

### Implemented

- multi-tenant Supabase data access with RLS-backed institution scoping
- student, lecturer, moderator, and admin role-aware dashboard flows
- assignment creation, submission, grading, moderation, and release workflows
- AI-assisted grading with lecturer review before student release
- document upload validation and extraction safety checks
- risk intelligence views with reason codes, model versioning, and evaluation metadata
- institution-scoped export workflows with audit logging and redaction support
- audit trails for key academic and administrative actions
- demo-mode routes that use synthetic data only

### Demo-only

- all routes prefixed with `Demo*`
- reviewer walkthroughs that use fabricated assignments, submissions, grades, and risk records
- demo exports and demo dashboards that do not call live academic data

### Under pilot validation

- cross-institution isolation and RLS hardening
- export safety and redaction behaviour
- AI grading guardrails and prompt-injection resistance
- risk model evaluation and false-positive feedback loops
- runtime access-control proof via contract and live tests
- reviewer-pack evidence capture and documentation completeness

### Not production-ready yet

- no claim of institution-wide deployment readiness
- no formal external accreditation approval
- no universal data residency sign-off for every possible institution
- no guaranteed uptime or enterprise support commitment
- no replacement for institutional policy, moderation, or academic judgement

## At a Glance

- monitors grade, submission, and engagement patterns to flag risk early
- gives tutors, course leaders, and heads of department a cohort view
- records interventions and exports evidence for institutional reporting
- keeps AI-assisted grading available where institutions want it, without making it the product focus

AI output is draft support. Students only see feedback after educator review and release.

## Demo Mode

GradeAI includes a synthetic demo mode for reviewer walkthroughs and product evaluation. It uses fabricated assignments, rubrics, submissions, grades, integrity examples, and feedback, and never reads live academic data.

## Evidence And Review Material

- [Architecture](docs/ARCHITECTURE.md)
- [Security Model](docs/SECURITY_MODEL.md)
- [Pilot Status](docs/PILOT_STATUS.md)
- [Model Evaluation](docs/MODEL_EVALUATION.md)
- [Risk Model Transparency](docs/risk-model-transparency.md)
- [Screenshots](docs/screenshots/README.md)

Selected screenshot evidence:

- [lecturer dashboard overview](docs/screenshots/lecturer-dashboard-overview.jpg)
- [overview dashboard](docs/screenshots/overview-dashboard.jpg)
- [cohort analytics dashboard](docs/screenshots/cohort-analytics-dashboard.jpg)
- [grade distribution analytics](docs/screenshots/grade-distribution-analytics.jpg)
- [predictive risk analytics](docs/screenshots/predictive-risk-analytics.jpg)
- [student improvement plan](docs/screenshots/student-improvement-plan.jpg)
- [AI grade explanation](docs/screenshots/ai-grade-explanation.jpg)

Video evidence:

- none committed yet

## Evidence Pack Summary

Review path:

1. [Architecture](docs/ARCHITECTURE.md)
2. [Security Model](docs/SECURITY_MODEL.md)
3. [Pilot Status](docs/PILOT_STATUS.md)
4. [Model Evaluation](docs/MODEL_EVALUATION.md)
5. [Screenshots](docs/screenshots/README.md)

This repository shows a working pilot, not a finished institutional rollout. Live and demo routes are separated, and the tests are there to prove safety boundaries as well as features.

## Key Product Areas

### Staff workspace

Tutors and academic leads can identify students who may be struggling, review why they were flagged, manage follow-up actions, and record intervention evidence.

### Synthetic test view

Learners can submit work for open assignments, view released grades, and read educator-approved feedback in the demo and live test surface.

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
