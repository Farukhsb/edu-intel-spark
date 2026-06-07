# Pilot Status

GradeAI is a controlled pilot system. The codebase contains real, test-covered workflows, but it is not a finished institution-wide platform.

## Status Summary

| Area | Status | Notes |
|---|---|---|
| Multi-tenancy and RLS | Implemented and hardened | Institution-scoped tables, policies, and contract tests are in place. |
| Upload and extraction safety | Implemented and hardened | File validation, extraction failure handling, and grading-blocking behaviour are in place. |
| AI grading guardrails | Implemented and hardened | AI output is treated as draft support and lecturer review is required before student release. |
| Audit logging | Implemented and hardened | Major academic and administrative actions create audit events. |
| Risk transparency | Implemented and hardened | Predictions store versioning, timestamps, confidence, reason codes, and calibration data. |
| Export security | Implemented and hardened | Exports are institution-scoped, logged, and support redaction for reviewer/demo use. |
| Auth/account lifecycle | Implemented in the app | Role-aware auth flows and password-change flows exist and are test-covered. |
| Error handling/observability | Implemented | User-facing errors and safe logging are in place for key workflows. |
| Demo mode | Implemented | Demo routes use synthetic data only and are isolated from live academic data. |
| Live pilot validation | Ongoing | Runtime access checks, evaluation evidence, and institutional review still need pilot validation. |

## What Is Implemented

- React dashboard routes for students, lecturers, moderators, and admins
- Supabase authentication and profile-based role resolution
- institution-scoped data access for core academic workflows
- assignment, submission, grading, moderation, risk, and export flows
- contract tests covering cross-institution boundaries and role permissions
- demo data paths that are synthetic and isolated from live data

## What Is Demo-Only

- every `Demo*` route in `src/pages/`
- demo dashboards that load fabricated assignments, submissions, grades, integrity cases, and risk records
- reviewer walkthrough screens that should not be connected to live student data
- demo exports that intentionally use synthetic content only

## What Is Under Pilot Validation

- live runtime proof that cross-institution access stays blocked
- operational behaviour in a real institutional Supabase project
- export redaction behaviour for reviewer-facing and demo-facing reports
- risk model evaluation quality, false-positive feedback, and intervention outcome tracking
- deployment, support, and governance evidence for a real institution

## What Is Not Production-Ready Yet

- no claim of a full enterprise support model
- no claim of universal institutional data residency approval
- no claim of formal external certification or accreditation approval
- no claim that the system should replace institutional processes or academic judgement

## Screenshots And Evidence

The repository includes screenshots as evidence of the working product:

- [`docs/screenshots/overview-dashboard.jpg`](screenshots/overview-dashboard.jpg)
- [`docs/screenshots/lecturer-dashboard-overview.jpg`](screenshots/lecturer-dashboard-overview.jpg)
- [`docs/screenshots/cohort-analytics-dashboard.jpg`](screenshots/cohort-analytics-dashboard.jpg)
- [`docs/screenshots/grade-distribution-analytics.jpg`](screenshots/grade-distribution-analytics.jpg)
- [`docs/screenshots/predictive-risk-analytics.jpg`](screenshots/predictive-risk-analytics.jpg)
- [`docs/screenshots/student-improvement-plan.jpg`](screenshots/student-improvement-plan.jpg)
- [`docs/screenshots/ai-grade-explanation.jpg`](screenshots/ai-grade-explanation.jpg)

## Suggested Review Order

1. [`../README.md`](../README.md)
2. [`ARCHITECTURE.md`](ARCHITECTURE.md)
3. [`SECURITY_MODEL.md`](SECURITY_MODEL.md)
4. [`MODEL_EVALUATION.md`](MODEL_EVALUATION.md)
5. [`AUTHORIZATION_REFERENCE.md`](AUTHORIZATION_REFERENCE.md)
6. [`screenshots/`](screenshots/)

## Reviewer Note

This document is intentionally conservative. If a claim is not validated in code, in tests, or in repository evidence, it should not be presented as production-ready.
