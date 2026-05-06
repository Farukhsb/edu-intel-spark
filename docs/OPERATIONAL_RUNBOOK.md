# GradeAI Operational Runbook

This runbook explains the practical operational checks for deploying, maintaining, and troubleshooting GradeAI without exposing secrets or student data.

It is intended for the project maintainer and future contributors who need a safe checklist for frontend deployment, Supabase Edge Functions, database migrations, environment variables, workflow failures, rate limits, and logging.

---

## 1. Deployment overview

GradeAI is operated across three main layers:

1. Frontend application
   - React / Vite / TypeScript / Tailwind
   - Deployed through the configured hosting platform, currently Cloudflare Pages for production-style deployment.

2. Supabase backend
   - Database tables and RLS policies
   - Authentication
   - Storage where applicable
   - Edge Functions for AI grading, plagiarism/integrity, explanation/tutoring, workflow notifications, and related server-side operations.

3. External services
   - OpenAI or configured AI provider
   - Resend or future email provider, where enabled
   - Logging/monitoring tools such as Sentry or provider dashboards, where configured

Do not expose service-role keys, provider API keys, email secrets, or student data in frontend code, screenshots, logs, GitHub issues, or documentation.

---

## 2. Frontend deployment checklist

Before deploying the frontend:

- Confirm the target branch is correct.
- Confirm recent tests/build have passed locally or in CI.
- Confirm no `.env` files or secrets are committed.
- Confirm public environment variables are safe to expose. Variables prefixed with `VITE_` are bundled into the frontend and must not contain secrets.
- Confirm the deployed app URL matches the expected production or preview environment.

Recommended local checks:

```bash
npm install
npm run test
npm run test:perf
npm run build
```

The `test:perf` suite is a lightweight regression harness for large in-memory workflow paths. It is not a substitute for real load testing, but it helps catch accidental complexity spikes in:

- performance analytics projection
- moderation queue sorting
- admin operational snapshot generation

If the build fails:

1. Read the first TypeScript or Vite error carefully.
2. Check whether the failure is caused by a missing import, invalid type, missing environment variable, or broken route/component export.
3. Fix the smallest issue first.
4. Re-run `npm run build` before deployment.

After deployment:

- Open the deployed URL.
- Check login works for the relevant test roles.
- Check lecturer dashboard loads.
- Check student dashboard loads.
- Check no browser console errors expose sensitive data.
- Check key routes are not blank or stuck in loading state.

---

## 3. Supabase Edge Function deployment checklist

Common Edge Functions may include grading, plagiarism/integrity checks, explanation/tutoring, email notifications, and workflow automation.

Before deploying Edge Functions:

- Confirm the function uses server-side secrets only.
- Confirm request validation is in place where expected.
- Confirm errors are logged safely without full student submissions or secret values.
- Confirm rate limits still protect high-cost functions.
- Confirm the function still respects role/permission checks.

Typical deployment command pattern:

```bash
npx supabase functions deploy <function-name>
```

Deploy each changed function explicitly. Avoid assuming all functions were deployed if only one was changed.

After deploying a function:

- Run a small controlled test using a dummy assignment/submission.
- Check Supabase function logs for errors.
- Confirm the frontend receives a safe, structured response.
- Confirm failed calls do not leak secrets or full private content.

---

## 4. Required environment variables and secrets

There are two categories of configuration.

### Frontend-safe variables

Frontend variables are exposed to the browser and must not contain secrets.

Examples may include:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Only use anon/public keys in frontend variables.

### Server-side secrets

Server-side secrets must be stored in Supabase secrets or the relevant backend environment, never in frontend code.

Examples may include:

```bash
OPENAI_API_KEY=
RESEND_API_KEY=
EMAIL_FROM_ADDRESS=
EMAIL_NOTIFICATIONS_ENABLED=
APP_BASE_URL=
```

Example command pattern:

```bash
npx supabase secrets set KEY_NAME=value
```

For email notifications, keep sending disabled until a sender/domain and API key are properly configured:

```bash
npx supabase secrets set EMAIL_NOTIFICATIONS_ENABLED=false
```

Only enable live sending after sender verification and smoke testing are ready.

---

## 5. Supabase migration checks

Before applying migrations:

- Confirm you are connected to the correct Supabase project.
- Confirm the migration file names use the expected timestamp format.
- Review the migration diff before applying.
- Check whether the migration affects RLS policies, role helpers, auth-sensitive tables, or production data.
- Do not rename historical migrations casually.
- Do not manually edit hosted migration ledger entries unless there is a deliberate recovery plan.

Recommended local review commands:

```bash
npx supabase status
npx supabase migration list
```

Before pushing to a hosted project:

```bash
npx supabase db push --linked --dry-run
```

If the dry-run output looks wrong, stop and investigate before applying anything.

After applying migrations:

- Regenerate Supabase types if schema changes affect frontend/types.
- Re-run tests/build.
- Verify RLS-sensitive workflows with test users.
- Confirm no unrelated user role gained access to private records.

Migration history note:

The previous migration-history reconciliation work is documented separately in:

```text
docs/SUPABASE_MIGRATION_HISTORY_RECONCILIATION_PLAN.md
```

A new database has been created, and the old migration-history blocker should be treated as resolved for the current operational baseline. Keep the reconciliation document for audit/history, but use the new database as the clean baseline going forward.

---

## 6. Troubleshooting grading failures

If AI grading fails:

1. Confirm the assignment and submission exist.
2. Confirm the authenticated user has permission to run grading.
3. Check whether the AI provider key is configured server-side.
4. Check Edge Function logs for validation, rate-limit, provider, or timeout errors.
5. Confirm the response schema still matches what the frontend expects.
6. Check whether the submission text is empty, too short, unreadable, or unsupported.
7. Re-run with a dummy submission before testing with real student content.

Common causes:

- Missing provider API key
- Invalid request body
- Rate limit triggered
- Provider timeout
- Schema validation failure
- RLS preventing lookup of assignment/submission records
- Frontend expecting an old response shape

Safe logging rule:

Log IDs, statuses, error codes, and short diagnostic messages. Do not log full submissions, API keys, raw provider prompts, or sensitive student details.

---

## 7. Troubleshooting plagiarism / integrity failures

If plagiarism or integrity checking fails:

1. Confirm the submission and assignment exist.
2. Confirm the current user has permission to trigger the check.
3. Confirm the function can read the relevant submissions for that assignment.
4. Confirm the current provider route is correct.
5. Check whether the result is marked `analysis_limited` because the text is too short, empty, unreadable, or unsupported.
6. Check whether RLS is blocking access to related submissions or stored findings.
7. Confirm existing UI expectations have not been broken by provider upgrades.

For internal text similarity:

- Confirm self-comparison is skipped.
- Confirm comparisons are scoped to the same assignment.
- Confirm the similarity score is calculated deterministically.
- Confirm findings are stored as review evidence, not final misconduct decisions.

For future external providers:

- Confirm provider secrets are server-side only.
- Confirm external calls are not made from the frontend.
- Confirm raw provider responses are sanitised before being stored or displayed.

---

## 8. Troubleshooting explain-grade / tutoring failures

If explain-grade or tutoring support fails:

1. Confirm the student has access to the relevant released grade.
2. Confirm the grade, feedback, and rubric breakdown exist.
3. Confirm the Edge Function validates the request body.
4. Confirm the provider key is configured.
5. Check whether rate limiting has blocked repeated requests.
6. Confirm the response is safe, student-facing, and does not reveal hidden moderation notes or other students' data.

The explain-grade flow should help the student understand feedback. It should not override the grade, expose private lecturer notes, or make unsupported promises about grade changes.

---

## 9. Rate-limit troubleshooting

High-cost or abuse-sensitive operations should remain rate-limited, especially:

- AI grading
- plagiarism/integrity checks
- explain-grade/tutoring chat
- notification/email workflows where applicable

If a user reports a rate-limit issue:

1. Check whether the user repeated the same action many times.
2. Check the relevant function logs for rate-limit responses.
3. Confirm the limit is applied by user, role, function, or IP as intended.
4. Confirm normal use is not blocked too aggressively.
5. Avoid disabling rate limits globally unless there is a clear temporary reason.

The frontend should show a calm message such as:

```text
This action has been temporarily limited. Please try again shortly.
```

Do not expose internal rate-limit keys or implementation details to users.

---

## 10. Logging and Sentry checks

Logging should help diagnose failures without exposing private data.

Safe to log:

- request ID
- user ID where necessary
- role
- assignment/submission IDs
- provider name
- status code
- error category
- short error message
- latency
- rate-limit status

Do not log:

- API keys
- Supabase service-role key
- full student submissions
- raw prompts containing student work
- full AI provider responses if they contain private content
- passwords or temporary credentials
- personal student details beyond what is operationally necessary

When checking Sentry or logs:

1. Filter by timestamp and function/route.
2. Check error category before reading full context.
3. Redact sensitive details before copying anything into GitHub issues or documentation.
4. If sharing evidence publicly, use dummy data or screenshots with private fields hidden.

The admin dashboard now includes a failure-oriented operational section that surfaces observed workflow pressure rather than claiming definitive service uptime. Use it to spot:

- grading failures visible in the workflow audit window
- approved but unreleased submissions
- overdue moderation cases
- escalated or high-risk integrity cases

Treat those cards as triage signals. They are derived from observable application state, not from a dedicated monitoring backend.

---

## 11. Permission and RLS verification checklist

The following hosted permission checks have been completed and verified for the current baseline:

- Students cannot access another student's data.
- Moderators only see assigned moderation records.
- Admin read-only oversight works correctly.
- Lecturer visibility is scoped to their own assignments/students.

Re-run these checks after any migration or code change that touches:

- RLS policies
- user roles
- profiles
- submissions
- assignments
- grades
- moderation tables
- admin oversight views
- integrity findings

---

## 12. Incident checklist

For a serious production issue:

1. Pause risky changes.
2. Identify the affected area: frontend, Edge Function, database, auth/RLS, external provider, or deployment config.
3. Check recent commits, deployments, migrations, and secret changes.
4. Reproduce with dummy data where possible.
5. Apply the smallest safe fix.
6. Re-run tests/build.
7. Verify role-based access again if auth or RLS was touched.
8. Document the incident and fix in a GitHub issue or PR summary.

Never fix a production issue by weakening RLS broadly, exposing service-role keys, disabling auth checks, or logging full student content.

---

## 13. Current operational baseline

As of this runbook:

- The hardening sprint has been completed and merged.
- Hosted RLS / permission verification for key roles has been completed.
- Migration history hygiene has been addressed by creating a new database and retaining the reconciliation document for audit/history.
- This runbook documents the operational steps required to deploy, maintain, and troubleshoot the platform safely.

This document should be updated whenever deployment architecture, Edge Function names, environment variables, or provider integrations change.
