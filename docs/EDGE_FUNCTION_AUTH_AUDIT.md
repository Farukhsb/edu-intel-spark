# Edge Function Authentication Audit

Audit date: 2026-04-24

## Purpose

This document records a focused authentication and authorization audit of GradeAI Supabase Edge Functions.

The audit checks whether Edge Functions that disable Supabase gateway JWT verification still enforce authentication and role checks inside the function code before handling academic data, grading actions, integrity checks, or bulk student operations.

This document replaces the earlier root-level `SECURITY_NOTES.md` working note so the repository keeps security evidence in a clearer and more intentional documentation structure.

## Scope

The audit covered local Edge Functions configured with `verify_jwt = false`:

- `check-plagiarism`
- `grade-submission`
- `explain-grade`
- `bulk-create-students`

It also reviewed the stale `student-ai-tutor` configuration entry that no longer had matching local function source.

## Main Risk Reviewed

Disabling gateway JWT verification can be safe only when the function performs strict manual authentication and authorization checks internally.

The key risk is that a function could accept requests without a trusted user identity, allowing unauthorized access to student submissions, grading workflows, integrity reports, or administrative operations.

## Findings

### `check-plagiarism`

Current status: acceptable with manual checks.

Observed controls:

- requires an `Authorization` header through the shared auth helper
- calls `requireLecturer(req)`
- verifies that the caller owns the assignment before processing
- limits plagiarism and integrity actions to authorized lecturer workflows

### `grade-submission`

Current status: acceptable with manual checks.

Observed controls:

- requires an `Authorization` header through the shared auth helper
- calls `requireLecturer(req)`
- verifies assignment ownership before grading
- resolves roles again for admin-only force regrading paths
- keeps AI grading inside lecturer-controlled review workflows

### `explain-grade`

Current status: acceptable with manual checks.

Observed controls:

- requires an `Authorization` header through the shared auth helper
- calls `requireUser(req)`
- intended for authenticated users only
- should only expose released or permitted explanation context according to the surrounding application workflow

### `bulk-create-students`

Current status: acceptable with manual checks.

Observed controls:

- requires an `Authorization` header through the shared auth helper
- calls `requireLecturer(req)`
- restricts use to lecturer or admin callers
- supports controlled onboarding rather than anonymous account creation

## Removed Stale Function Entry

### `student-ai-tutor`

The `student-ai-tutor` entry was removed from Supabase configuration because:

- no local function source exists in `supabase/functions/student-ai-tutor`
- no frontend invocation exists in the current repository
- keeping stale deployment configuration could mislead future reviewers about shipped functionality

If this function is reintroduced later, it should either use gateway JWT verification or perform explicit `requireUser(req)` checks inside the function.

## Why Gateway JWT May Be Disabled Intentionally

Some Edge Functions disable gateway JWT verification to support custom CORS handling or request processing patterns.

That is acceptable only when the function still:

- reads the caller's `Authorization` header
- verifies the user with Supabase
- resolves the user's trusted role from server-side data
- checks ownership or permission for the requested academic resource
- fails closed when authentication or authorization cannot be proven

The four audited local functions follow this manual-auth pattern through shared helpers such as `requireUser(req)` and `requireLecturer(req)`.

## Recommendations

- Keep the four audited local functions unchanged for now.
- Continue treating `student-ai-tutor` as inactive until source code is restored and reviewed.
- Do not allow any function with `verify_jwt = false` unless it performs explicit manual authentication and authorization checks.
- Prefer server-side role resolution over client-controlled profile state.
- Add regression tests for lecturer-only and student-only Edge Function boundaries where practical.
- Review this document whenever a new Edge Function is added or an existing function changes authentication behaviour.

## Current Conclusion

The reviewed Edge Functions intentionally disable gateway JWT verification but compensate with in-function authentication and role checks.

The current pattern is acceptable for the controlled pilot stage, provided future functions follow the same fail-closed authorization model and the team continues to test role boundaries before production rollout.