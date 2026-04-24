# Release Readiness Checklist

Use this before demos, stakeholder reviews, pilot rollouts, or production pushes.

This is intentionally practical. It is not a governance document; it is the minimum checklist needed to avoid presenting a broken or misleading build.

## 1. Repo State

- working tree is clean
- target branch is correct
- latest hardening and migration commits are pushed
- README reflects the current product and setup expectations
- no accidental local-only files are staged

## 2. Database State

- target Supabase project is the intended one
- latest repo migrations are applied
- RLS and RPC changes are present on the target database
- known migration-history quirks are understood and documented

For this repo, note:
- legacy short-form migration IDs `20260412` and `20260413` may still appear in Supabase CLI history output
- treat that as a historical ledger quirk unless live behavior contradicts it

## 3. Edge Function State

- changed Edge Functions are deployed to the target project
- required secrets are present for those functions
- critical functions respond normally:
  - `grade-submission`
  - `check-plagiarism`
  - `explain-grade`
  - `bulk-create-students`

## 4. Test State

Run:

```bash
npm run test
npm run build
```

If browser coverage is part of the release gate, also run:

```bash
npm run test:e2e
```

Minimum expectation:
- unit/integration tests pass
- production build passes
- critical Playwright workflows pass if they are part of the release candidate

## 5. High-Trust Workflow Checks

Confirm these are still true:
- lecturer review -> approve -> release works
- moderation blocks premature approval
- students only see released grades
- integrity decision save flow works
- recommendation actions persist
- no obvious permission regressions appear in moderation, integrity, or analytics flows

## 6. Live Role-Boundary Smoke

Run:
- [LIVE_ROLE_BOUNDARY_SMOKE.md](C:/Users/a3dullahi/edu-intel-spark/docs/LIVE_ROLE_BOUNDARY_SMOKE.md)

Do not skip this when:
- migrations changed
- RLS changed
- recommendation/moderation/integrity ownership logic changed

## 7. UI / Presentation Check

Before presenting:
- lecturer dashboard loads without runtime errors
- grouped sidebar renders correctly
- major dashboard pages open:
  - Overview
  - Assignments
  - Academic Integrity
  - Moderation
  - Cohort Analytics
  - Accreditation
- no obviously broken empty states, clipped layouts, or placeholder text remain

## 8. Communication Readiness

If the release/demo includes messaging or interventions:
- grade-release notifications can be queued
- intervention follow-up creation still works
- no silent failures occur when those actions are triggered

## 9. Go / No-Go Rule

**Go** if:
- tests/build pass
- latest DB changes are applied
- live role-boundary smoke passes
- no critical runtime errors appear in key dashboard routes

**No-Go** if:
- a student can see unreleased grades
- a lecturer can access another lecturer’s protected data
- moderation no longer blocks approval correctly
- integrity or recommendation persistence is broken
- critical migrations are unapplied or unverified
