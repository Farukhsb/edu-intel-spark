# GradeAI Production Hardening Summary

## Overview

This document summarises the recent production-hardening work completed on GradeAI.

GradeAI is an academic intelligence platform for assessment, feedback, moderation, integrity review, and early student support. Because the platform handles grades, feedback, student support signals, and academic integrity outputs, the system has to be treated as a high-trust workflow rather than a simple AI demo.

The recent hardening work focused on one question:

> Can GradeAI behave safely when AI responses are malformed, requests fail, users cross role boundaries, or high-cost functions are called repeatedly?

The answer is now much stronger than before. The platform has been improved across validation, visibility, rate limiting, logging, environment configuration, type safety, and end-to-end trust-boundary testing.

## Why This Work Was Needed

AI-assisted academic tools can create real risk if they trust outputs too easily.

In an assessment system, a malformed AI grading response is not just a technical problem. It can lead to wrong marks being saved, misleading feedback being shown, or a lecturer seeing incomplete integrity information. Similarly, if approved-but-unreleased feedback becomes visible to a student too early, that is a governance failure rather than a cosmetic bug.

The hardening work was therefore designed around practical academic trust:

- AI output should be validated before it is saved or shown.
- Students should only see released outcomes.
- External examiner workflows should not expose draft or unreleased records.
- High-cost AI functions should not be easy to abuse.
- Production logs should not leak sensitive academic content.
- Environment misconfiguration should fail early and clearly.
- Tests should prove important academic boundaries, not just page rendering.

## Main Improvements Completed

### 1. AI And API Response Validation

Zod validation was added for high-risk response payloads.

Validated areas now include:

- AI grading responses
- grade breakdown structures
- explanation and tutoring responses
- plagiarism and integrity payloads
- the current batch response shape returned by the plagiarism/integrity Edge Function

The important design choice is that validation happens at the boundary. Raw Edge Function results are checked before grade fields are saved, and stored grade breakdowns are checked before they are rendered in student-facing views.

If validation fails, the app does not render or save the malformed data as trusted academic information. Instead, it falls back safely, keeps existing state where appropriate, and logs safe diagnostic context.

### 2. Student Visibility Boundary

A key trust rule was strengthened and tested:

> Students should only see released grades and feedback.

The system now protects against approved-but-unreleased feedback being shown to students. This matters because approval and release are different academic workflow stages. A lecturer may approve a grade internally while still needing moderation, final review, or release control before the student sees it.

A Playwright E2E test now proves this boundary in a browser workflow:

1. A lecturer reviews and approves a submission.
2. The student cannot see the score or feedback while it is only approved.
3. The lecturer releases the submission.
4. The student can then see the released score and lecturer-approved feedback.
5. Draft AI feedback remains hidden throughout.

This gives browser-level proof that the most important student-facing trust rule works in practice.

### 3. External Examiner Export Governance

External examiner export logic was tightened so draft or unreleased records are not treated as governed export data.

This matters because external examiner exports are not ordinary downloads. They are part of academic quality assurance. The export workflow should only include records that are appropriate for review.

The project now has automated coverage for export preview, export behaviour, and governed-record filtering.

### 4. Rate Limiting For High-Cost Edge Functions

Rate limiting was added to the most expensive and abuse-sensitive Edge Functions:

- `grade-submission`
- `check-plagiarism`
- `explain-grade`

The limiter uses authenticated user identity where available, falls back to request IP where needed, and then uses a conservative anonymous bucket if no better identifier is available.

When the limit is exceeded, the functions return HTTP `429` with a safe response body and `Retry-After` header.

This protects the system from repeated clicks, accidental loops, and basic abuse that could trigger unnecessary AI/API cost.

### 5. Environment Variable Validation

A dedicated environment validation layer was added.

The app now validates key frontend configuration values such as:

- Supabase URL
- Supabase publishable key
- app environment
- optional Sentry configuration
- optional PostHog configuration

Invalid configuration fails early with a clear error naming the problematic variable. Actual secret values are not logged or exposed.

Test-mode handling was also normalised safely so Vitest and CI can run without weakening production validation.

### 6. Structured Logging And Sanitisation

A shared logger was introduced to replace high-risk raw console usage.

The logger separates development-only logging from production-safe error reporting. It also sanitises logged context so sensitive academic fields are not sent through raw logs.

Protected fields include:

- submissions
- grades
- private feedback
- AI prompts
- document text
- secrets

This matters because logs should help diagnose problems without becoming another place where private academic data is stored.

### 7. Critical Workflow Type Safety

Shared academic workflow types were introduced for important repeated shapes.

This reduced high-risk loose typing around:

- rubrics
- grade breakdowns
- AI grading response shapes
- external examiner export rows

The project did not switch on full TypeScript strict mode in one step. Instead, the work focused on the most important academic workflow paths first, which is safer for a fast-moving product.

### 8. Expanded Automated Testing

The test suite now covers more of the trust-critical areas of the platform.

Coverage includes:

- lecturer overview states
- student grade explanation and released-only visibility
- student profile and intervention states
- external examiner export filtering
- error boundary fallback behaviour
- network/API failure paths
- AI and API response validation
- environment parsing
- structured logger behaviour
- rate-limit behaviour
- Playwright E2E coverage for student visibility after release

The important point is that the tests now cover behaviour that matters for academic trust, not only whether components render.

## What This Means For GradeAI

This hardening work changes how GradeAI should be understood.

It is not just an AI grading interface. It is moving toward a controlled academic workflow system where AI is one input inside a governed process.

The system now has clearer safeguards around:

- what data is trusted
- when students can see outcomes
- how AI responses are validated
- how expensive backend functions are protected
- how errors fail safely
- how logs avoid sensitive academic content
- how tests prove important boundaries

This makes the project more credible for review by technical assessors, academic stakeholders, and anyone evaluating whether the product has been built with real-world risk in mind.

## Remaining Work

The recent hardening work significantly improves the foundation, but GradeAI should still be treated as a fast-moving prototype rather than a finished institution-wide system.

Useful next steps include:

- broader E2E coverage for moderation and external examiner workflows
- deeper live-environment role and RLS validation
- gradual TypeScript strictness improvements
- further reduction of any remaining low-risk `any` usage
- longer-term load and usage testing once real users are involved
- clearer operational runbooks for deployment and incident response

## Summary

The hardening sprint improved GradeAI across validation, governance, observability, resilience, and testing.

The most important outcome is that GradeAI now has stronger evidence for responsible AI handling in an academic workflow:

- AI outputs are validated before use.
- Students only see released outcomes.
- High-cost functions are rate limited.
- Errors fail safely.
- Logs avoid sensitive academic data.
- CI is green.
- A browser-level E2E test proves the release visibility boundary.

This is the kind of engineering work that turns a working prototype into a system that can be taken seriously.