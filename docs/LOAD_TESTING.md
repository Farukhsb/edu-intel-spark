# GradeAI Load Testing

This document explains the repo-native load test path for the deployed stack.

The goal is not to stress AI providers or create write-heavy academic workflow noise. The default harness is intentionally read-heavy and safe by default.

## What it covers

The load test script can exercise:

- frontend home page availability
- lecturer assignment reads
- lecturer submission reads
- moderator queue reads
- student grade reads

These are the highest-value low-risk live paths for checking whether the deployed stack stays responsive under repeated access.

## Command

```bash
npm run test:load
```

## Required environment

At minimum:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

You can use `VITE_SUPABASE_ANON_KEY` instead of `VITE_SUPABASE_PUBLISHABLE_KEY`.

Optional:

```bash
VITE_APP_URL=
LOAD_TEST_LECTURER_JWT=
LOAD_TEST_MODERATOR_JWT=
LOAD_TEST_STUDENT_JWT=
LOAD_TEST_CONCURRENCY=5
LOAD_TEST_ITERATIONS=12
LOAD_TEST_TIMEOUT_MS=10000
```

## Recommended usage

Use real but tightly scoped pilot accounts:

- one lecturer account
- one moderator account
- one student account

Do not use production-wide privileged tokens. Do not use service-role secrets. Do not point the script at accounts that should not be part of testing.

## Scenario behavior

- `frontend-home`
  Runs when `VITE_APP_URL` is set.
- `lecturer-assignments`
  Runs when `LOAD_TEST_LECTURER_JWT` is set.
- `lecturer-submissions`
  Runs when `LOAD_TEST_LECTURER_JWT` is set.
- `moderator-cases`
  Runs when `LOAD_TEST_MODERATOR_JWT` is set.
- `student-grades`
  Runs when `LOAD_TEST_STUDENT_JWT` is set.

## Output

Each scenario prints:

- request count
- success count
- failure count
- error rate
- average latency
- p95 latency
- max latency

The command exits non-zero if any scenario records failures.

## Safety notes

- This harness avoids grading, explain-grade, plagiarism, and notification writes by default.
- That is deliberate. Those flows can be expensive, side-effectful, or academically noisy.
- If you later want heavier workflow load tests, add them as separate opt-in scenarios with dummy data and explicit safeguards.

## Suggested first live run

Start small:

```bash
LOAD_TEST_CONCURRENCY=3
LOAD_TEST_ITERATIONS=10
npm run test:load
```

Then increase carefully:

```bash
LOAD_TEST_CONCURRENCY=8
LOAD_TEST_ITERATIONS=25
npm run test:load
```

If failures appear:

1. Check whether they are permission failures, timeouts, or actual platform errors.
2. Compare lecturer, moderator, and student paths separately.
3. Cross-check the admin failure dashboard and Sentry for the same time window.
