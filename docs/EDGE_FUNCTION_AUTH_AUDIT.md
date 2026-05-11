# Edge Function Authentication Audit

Audit date: 2026-04-24

## Why this file exists

This started as a short security note while checking the Supabase Edge Functions. I moved it into `docs/` because it is useful enough to keep, but it should read as an audit record rather than a scratchpad.

The question I wanted to answer was simple:

> If an Edge Function has `verify_jwt = false`, is it still checking who the user is before doing anything sensitive?

For GradeAI this matters because these functions can touch submissions, grading, integrity checks, and student onboarding.

## Functions checked

The review covered the local functions that currently use `verify_jwt = false`:

- `check-plagiarism`
- `grade-submission`
- `explain-grade`
- `bulk-create-students`

I also checked the old `student-ai-tutor` config entry because it was still listed even though the matching function source was no longer present.

## Main risk

`verify_jwt = false` is not automatically wrong. It can be used where a function needs its own CORS handling or request handling.

The risk is when a function disables gateway JWT checks and then forgets to do the same work inside the function. In that case, someone could call the function without a trusted user identity.

For this project, the safe pattern is:

1. read the `Authorization` header
2. verify the Supabase user
3. resolve the role on the server side
4. check ownership or permission for the assignment, submission, grade, or student record
5. fail closed if any of that cannot be proven

## Findings

### `check-plagiarism`

Status: acceptable with the current manual checks.

What I checked:

- it requires an `Authorization` header through the shared auth helper
- it calls `requireLecturer(req)`
- it checks that the lecturer owns the assignment before processing
- it keeps integrity checking inside the lecturer workflow

### `grade-submission`

Status: acceptable with the current manual checks.

What I checked:

- it requires an `Authorization` header through the shared auth helper
- it calls `requireLecturer(req)`
- it checks assignment ownership before grading
- admin-only force regrading resolves roles again rather than trusting the frontend
- grading output still goes through lecturer review before release

### `explain-grade`

Status: acceptable with the current manual checks.

What I checked:

- it requires an `Authorization` header through the shared auth helper
- it calls `requireUser(req)`
- it is not intended to run for anonymous users
- the surrounding workflow still needs to protect unreleased feedback and grades

### `bulk-create-students`

Status: acceptable with the current manual checks.

What I checked:

- it requires an `Authorization` header through the shared auth helper
- it calls `requireLecturer(req)`
- it is restricted to lecturer/admin style onboarding flows
- it does not support open anonymous account creation

## Stale function config removed

### `student-ai-tutor`

This entry was removed from the Supabase config because there was no matching local source in `supabase/functions/student-ai-tutor` and no current frontend call to it.

Leaving it there would make the repo look like it ships a function that no longer exists locally.

If this function comes back later, it should either use gateway JWT verification or include explicit `requireUser(req)` checks inside the function.

## Recommendation

Keep the current four functions as they are for now, but keep this rule:

> No Edge Function should use `verify_jwt = false` unless it performs its own authentication and authorization checks inside the function.

For future work:

- prefer server-side role resolution over anything controlled by the client
- add regression tests around lecturer-only and student-only boundaries where practical
- review this file whenever a new Edge Function is added
- treat missing auth checks as a release blocker

## Current conclusion

The current pattern is acceptable for the controlled pilot stage. The functions that disable gateway JWT verification still perform manual auth checks before handling sensitive academic workflows.

This should not be treated as a permanent excuse to be loose with auth. If more functions are added, they need to follow the same fail-closed pattern.