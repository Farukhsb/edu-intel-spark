# Testing

This repository uses:

- `npm run test` for the Vitest unit and component suite
- `npm run test:coverage` for coverage reporting
- `npm run build` as a production build smoke test

## Coverage Gates

Coverage thresholds are intentionally non-trivial, but still calibrated to the
 current baseline so they can be enforced in CI without blocking unrelated work.

Current minimums:

- lines: 40
- statements: 40
- functions: 35
- branches: 25

These should be raised over time as currently untested route shells, auth
 flows, and dashboard pages gain direct test coverage.

## Security and RLS Testing

Coverage percentages are not a substitute for authorization testing.

RLS and security-sensitive behavior should be validated with:

- integration tests that exercise the real Supabase client against policy-backed tables
- SQL policy tests where possible for storage, submissions, grades, profiles, and moderation access
- edge-function tests that verify both authenticated success paths and forbidden paths

Priority areas for policy-oriented testing:

- submission file reads from `storage.objects`
- profile visibility for lecturers, moderators, students, and admins
- workflow notification email deduplication and retry behavior
- moderation-linked access to submissions, grades, and integrity reviews

## Edge Function Security Note

TODO:

The local Supabase function config still uses `verify_jwt = false` for several
edge functions, while the handlers enforce auth internally. After each function
has been rechecked for request validation and auth handling, plan a follow-up
migration toward `verify_jwt = true` to tighten the platform boundary at the
gateway as well as in application code.
