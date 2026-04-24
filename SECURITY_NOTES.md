# Edge Function JWT Review Notes

Audit date: 2026-04-24

## Current `verify_jwt = false` functions

- `check-plagiarism`
- `grade-submission`
- `explain-grade`
- `bulk-create-students`

## Intentional cases that are currently safe as-is

These functions disable gateway JWT, but they manually enforce authentication inside the function code:

- `check-plagiarism`
  - Requires `Authorization` header through shared auth helper.
  - Calls `requireLecturer(req)`.
  - Verifies the caller owns the assignment before processing.

- `grade-submission`
  - Requires `Authorization` header through shared auth helper.
  - Calls `requireLecturer(req)`.
  - Verifies assignment ownership.
  - Resolves roles again for admin-only force regrading.

- `explain-grade`
  - Requires `Authorization` header through shared auth helper.
  - Calls `requireUser(req)`.
  - Intended for authenticated users only.

- `bulk-create-students`
  - Requires `Authorization` header through shared auth helper.
  - Calls `requireLecturer(req)`.
  - Restricts use to lecturer/admin callers.

## Removed stale function entry

- `student-ai-tutor`
  - No local function source exists in `supabase/functions/student-ai-tutor`.
  - No frontend invocation exists in the current repo.
  - The stale `supabase/config.toml` entry was removed so deployment config matches the shipped codebase.
  - If this function is reintroduced later, it should either use gateway JWT verification or perform explicit `requireUser(req)` checks in-function.

## Why `verify_jwt` may be disabled intentionally

Disabling gateway JWT can be acceptable when a function needs custom CORS handling and still performs strict in-function checks using the caller's `Authorization` header and Supabase user lookup. That pattern is used by the four local functions above through `requireUser(req)` and `requireLecturer(req)`.

## Recommendation

- Keep the four audited local functions unchanged for now.
- Treat `student-ai-tutor` as inactive until function source is restored and reviewed.
- If a function does not perform manual auth checks like `requireUser` or `requireLecturer`, it should not keep `verify_jwt = false`.
