# GTV Evidence Summary: GradeAI Production Hardening

## Evidence Title

**GradeAI: Production Hardening of an AI-Assisted Academic Workflow Platform**

## Applicant

Abdullahi Faruk

## Project

GradeAI is an academic intelligence platform designed to support assessment, feedback, moderation, academic integrity review, and early student intervention.

The platform was built around a simple principle: AI can assist academic workflows, but it should not replace academic judgement or weaken institutional trust. Lecturers remain responsible for reviewing, approving, moderating, and releasing academic outcomes.

This evidence summary focuses on the production-hardening work completed after the main product features were working. The purpose of the hardening work was to make GradeAI safer, more reliable, and more credible as an AI-assisted academic system.

## Why This Work Matters

AI systems in education can create real risk if they are treated as ordinary automation tools. A malformed AI response, an early release of feedback, or an unchecked integrity signal can affect student outcomes and lecturer decisions.

For GradeAI, the technical challenge was not only to build grading and feedback features. The more important challenge was to make sure the system behaved responsibly around academic trust boundaries.

The hardening work addressed questions such as:

- What happens if an AI grading response is malformed?
- Can students see approved-but-unreleased feedback?
- Can draft AI feedback leak into student views?
- Can high-cost AI functions be repeatedly triggered?
- Can logs accidentally capture sensitive academic content?
- Can the app fail safely when network or API requests fail?
- Can the system prove important workflow rules through automated tests?

## Work Completed

### 1. AI And API Response Validation

I added Zod-based validation for high-risk runtime payloads before the app trusts, saves, or renders them.

Validation now covers:

- AI grading responses
- grade breakdown structures
- explanation and tutoring responses
- plagiarism and integrity response payloads
- the current batch response shape from the plagiarism/integrity Edge Function

This means GradeAI no longer blindly trusts AI or Edge Function responses. Malformed payloads are rejected safely instead of being treated as valid academic data.

### 2. Student Visibility Boundary

I strengthened the rule that students should only see released grades and feedback.

The system now protects against approved-but-unreleased feedback being shown to students. This is important because internal approval and student release are different academic stages.

A Playwright E2E test now proves this full browser workflow:

1. A lecturer reviews and approves a submission.
2. The student cannot see the score or feedback while the submission is only approved.
3. The lecturer releases the submission.
4. The student can then see the released score and lecturer-approved feedback.
5. Draft AI feedback remains hidden throughout.

This is one of the strongest trust-boundary proofs in the project.

### 3. External Examiner Export Governance

I tightened the external examiner export workflow so draft or unreleased records are not treated as governed export data.

External examiner export is not just a download feature. It is part of academic quality assurance, so only appropriate reviewed records should be included.

### 4. Rate Limiting For High-Cost Edge Functions

I added rate limiting to expensive and abuse-sensitive Supabase Edge Functions:

- `grade-submission`
- `check-plagiarism`
- `explain-grade`

The limiter uses authenticated user identity where possible, falls back to request IP, and then uses a conservative anonymous bucket if needed.

Exceeded requests return HTTP `429` with a safe response and a `Retry-After` header. This helps protect the system from accidental loops, repeated clicks, or deliberate abuse that could trigger unnecessary AI/API costs.

### 5. Environment Variable Validation

I added a dedicated environment validation layer so the frontend fails early when required configuration is missing or malformed.

The app validates Supabase, app environment, Sentry, and PostHog-related values without exposing secrets. Test-mode handling was also normalised so CI remains stable without weakening production validation.

### 6. Structured Logging And Sanitisation

I introduced a shared logger to replace high-risk raw console usage.

The logger separates development-only logs from production-safe error reporting and sanitises context to avoid leaking sensitive academic information.

Protected fields include:

- student submissions
- grades
- private feedback
- AI prompts
- document text
- secrets and environment values

### 7. Critical Workflow Type Safety

I added shared academic workflow types and reused Zod-inferred types in high-risk paths.

This reduced unsafe casting around:

- rubrics
- grade breakdowns
- AI response shapes
- external examiner export rows

Instead of enabling full TypeScript strict mode in one risky step, I focused first on the academic workflow areas where weak typing could create the greatest risk.

### 8. Expanded Test Coverage

The test suite was expanded across the highest-risk areas of the product.

Coverage now includes:

- lecturer overview dashboard states
- student-facing grade explanation and released-only visibility
- student profile and intervention states
- external examiner export filtering
- application error boundary fallback behaviour
- network/API failure paths
- AI and API response validation
- environment parsing
- structured logger behaviour
- rate-limit behaviour
- Playwright E2E coverage for the student release boundary

The tests are not only about increasing coverage numbers. They prove academic workflow rules that matter for trust.

## Technical Evidence Files

The following files document and demonstrate this work:

- `README.md` — includes the Recent Hardening section
- `docs/TRUST_MODEL.md` — explains GradeAI’s academic trust model
- `docs/GRADEAI_PRODUCTION_HARDENING_SUMMARY.md` — detailed hardening summary
- `src/lib/schemas/aiResponses.ts` — Zod validation schemas
- `src/lib/env.ts` — environment validation
- `src/lib/logger.ts` — structured logging and sanitisation
- `supabase/functions/_shared/rate-limit.ts` — shared Edge Function rate limiter
- `tests/e2e/assessment-workflows.spec.ts` — E2E student visibility boundary test
- `src/test/aiResponses.test.ts` — AI/API response validation tests
- `src/test/env.test.ts` — environment validation tests
- `src/test/logger.test.ts` — structured logger tests
- `src/test/rateLimit.test.ts` — rate limit tests

## Proof Points

The work is supported by:

- green GitHub Actions on `main`
- automated unit and integration tests
- Playwright E2E tests
- documented trust model
- documented production hardening summary
- clear commit history showing incremental engineering decisions

## Before And After

| Area | Before hardening | After hardening |
|---|---|---|
| AI response handling | AI/Edge Function payloads could be trusted too easily | High-risk AI/API payloads are validated with Zod before use |
| Student visibility | Student visibility relied mainly on workflow assumptions | Released-only visibility is tested and proven through E2E coverage |
| Failure handling | Some failures could risk stale or misleading UI states | Error boundary and network failure paths have safe fallback coverage |
| High-cost functions | Repeated calls could trigger unnecessary AI/API cost | Grading, plagiarism, and explanation functions are rate limited |
| Environment configuration | Misconfiguration could fail later at runtime | Required frontend environment values are validated early |
| Logging | Raw console usage risked unsafe context exposure | Structured logger sanitises sensitive academic fields |
| Type safety | Some critical workflow shapes relied on loose casts | Shared academic workflow types and Zod-inferred types reduce risk |
| Documentation | Hardening work was spread across commits | Trust model and production hardening summary explain the system clearly |

## Personal Contribution

My contribution was not only to add features, but to identify and reduce the risks that would make an AI-assisted academic platform hard to trust.

I worked through the system in layers:

1. identify trust boundaries
2. validate AI and API responses
3. prevent early student visibility
4. protect expensive backend functions
5. make configuration safer
6. improve logging discipline
7. tighten high-risk types
8. prove important rules through tests and CI
9. document the trust model in plain English

This reflects the kind of engineering judgement needed for responsible digital technology: building the feature is only one part of the work; making the system safe, explainable, and reviewable is just as important.

## Relevance To Global Talent Evidence

This work demonstrates several strengths relevant to a digital technology endorsement application:

- practical full-stack product development
- responsible AI integration
- secure and explainable academic workflow design
- production hardening of a real software system
- use of modern tools such as React, TypeScript, Supabase, Edge Functions, Zod, Playwright, Sentry, and CI
- evidence of iterative engineering judgement rather than one-off feature building
- documentation of system design, risks, safeguards, and validation strategy

The project shows that I can build beyond a demo. I can design, harden, test, and document a system where trust matters.

## Remaining Work

GradeAI should still be treated as a fast-moving prototype rather than a finished institution-wide platform.

Useful next steps include:

- more E2E coverage for moderation and external examiner workflows
- deeper live RLS and role-boundary verification
- gradual TypeScript strictness improvements
- operational runbooks for deployment and incident response
- longer-term load and usage validation with real users

## Summary

The GradeAI hardening work turned a working AI-assisted academic platform into a more credible and safer system.

The most important result is that GradeAI now has evidence-backed safeguards around AI response validation, student visibility, rate limiting, environment configuration, structured logging, and workflow testing.

This is the difference between building an AI feature and building an AI-assisted system that can be reviewed, trusted, and improved responsibly.