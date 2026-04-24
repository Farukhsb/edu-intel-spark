# Testing Checklist

This is a practical manual checklist for day-to-day testing and pre-release validation.

It is written for how the app works today, not for an ideal future version. The goal is simple: catch broken flows before someone else does.

## Before You Start

Make sure you have:

- a working frontend build connected to the intended Supabase project
- at least one lecturer account
- at least one student account
- at least one admin account if you are validating the admin dashboard or role-management flows
- enough seeded or real data to test assignments, submissions, grading, and moderation

If you are testing against a shared environment, confirm which project you are using before you start. A lot of confusion in this app comes from thinking you are on one Supabase project when you are actually on another.

## Quick Pre-Release Gate

Run these first:

```bash
npm run test
npm run build
```

If browser coverage is part of the release gate, also run:

```bash
npm run test:e2e
```

Then do the manual checks below.

## 1. Login

### Lecturer login

1. Open the app in a fresh browser session or private window.
2. Go to `/auth`.
3. Sign in with a lecturer account.
4. Confirm you land on the dashboard without a blank screen, redirect loop, or obvious console error.
5. Open a few lecturer pages:
   - Overview
   - Assignments
   - Moderation
   - one analytics page
6. Sign out.
7. Confirm you return to a public route and cannot still access dashboard pages by refreshing.

Expected result:

- sign-in works
- dashboard routes load
- sign-out clears access cleanly

### Student login

1. Sign in with a student account.
2. Confirm the student lands in the student-facing dashboard area.
3. Open Assignments and Student Grades.
4. Confirm lecturer-only pages are not exposed through the normal navigation.
5. Sign out.

Expected result:

- student can log in and browse student pages
- student does not see lecturer-only controls or pages

### Admin login

1. Sign in with an admin account.
2. Confirm the admin lands on the admin dashboard rather than the lecturer or student home.
3. Open:
   - Admin Dashboard
   - User Management
   - System Overview
   - one reporting page
4. Confirm the page loads even if the audit log view is empty in that environment.
5. Sign out.

Expected result:

- admin can sign in and reach the admin dashboard cleanly
- admin navigation feels like an admin surface, not a student or lecturer shell
- missing optional admin-only data should degrade safely instead of blanking the whole page

## 2. Assignment Creation

Use a lecturer account.

1. Open the Assignments page.
2. Create a new assignment with:
   - title
   - module code
   - max score
   - due date
   - at least one rubric criterion if the form supports it
3. Save the assignment.
4. Confirm the new assignment appears in the list.
5. Open the assignment detail page.
6. Confirm the title, module code, status, and rubric data look correct.
7. Publish the assignment.
8. Return to the assignments list and confirm the status changes from `draft` to `published`.

Expected result:

- assignment creation succeeds
- created data is visible immediately
- publish action works and the new state persists after refresh

## 3. Submission Flow

This needs one lecturer account and one student account.

### Student submission

1. As a student, open a published assignment.
2. Upload a valid submission file.
3. Confirm the app shows a success state and the submission appears in the assignment view.
4. Refresh the page and confirm the submission still appears.

Expected result:

- upload works
- submission is stored and survives refresh

### Lecturer review of submission

1. Switch to the lecturer account.
2. Open the same assignment detail page.
3. Confirm the student submission is visible in the submission list.
4. Trigger AI grading if that path is enabled for the current environment.
5. Wait for the submission to move out of `ai_grading`.
6. Confirm a grade record appears with score and feedback.
7. If the submission lands in `first_review`, complete lecturer review.
8. Approve the submission if moderation is not required.
9. Release the grade.
10. Switch back to the student account and confirm the released grade is visible in Student Grades.

Expected result:

- lecturer can see the uploaded submission
- grading completes without the submission being stuck in `ai_grading`
- approved work can be released
- students only see the result after release

## 4. Moderation Flow

Use a case that is actually eligible for moderation.

1. As a lecturer, open the assignment detail page for a graded submission.
2. Send the case into moderation through the current review flow.
3. Open the Moderation dashboard.
4. Confirm the moderation case appears in the queue.
5. Confirm the queue card shows:
   - student record
   - assignment title
   - enabled `Review case` button when submission data exists
6. Assign a moderator.
7. Confirm the case moves to `moderation_in_progress`.
8. Open the case and test the available actions:
   - `agree`
   - `adjust`
   - `return`
   - `escalate`
9. Confirm the resulting status changes make sense after each action.
10. Where applicable, confirm moderation notes and score changes persist after refresh.
11. If the case is ready, complete the lecturer approval step.

Expected result:

- moderation queue loads
- assignment and student context are visible when linked data exists
- `Review case` is disabled only when the linked submission is missing
- actions save without permission errors
- approval is still restricted to the assignment owner where that rule applies

### Nullable fallback check

This is worth checking when moderation migrations or queue joins have changed.

1. Open a moderation case with missing linked submission data, if one exists in the environment.
2. Confirm the card falls back to placeholder text rather than crashing.
3. Confirm `Review case` is disabled for that case.

Expected result:

- missing related data degrades safely
- the page does not throw

## 5. Analytics Pages

Use a lecturer account with enough assignment and submission data to produce meaningful output.

Open and check these pages:

- Cohort Analytics
- Performance Trends
- Institutional Insights
- Accreditation

For each page:

1. Confirm the page loads without a runtime error.
2. Confirm charts and summary cards render.
3. Confirm empty states look intentional if there is no data.
4. Refresh the page once to catch any fragile client-side assumptions.
5. If filters or drill-down links exist, click through at least one.

Expected result:

- no blank states caused by JS errors
- charts render
- counts and labels look plausible for the current dataset
- empty states are understandable instead of broken

## 6. Export Features

Use a lecturer account with some graded submissions.

### External examiner export

1. Open the External Examiner Export page.
2. Confirm assignments load into the filter.
3. Toggle a few include options.
4. Export a standard CSV.
5. Export a detailed CSV.
6. Open both files and confirm the output includes the selected fields.
7. Check a few rows against the app UI for accuracy:
   - student name
   - assignment title
   - final score
   - status
   - reviewed by

Expected result:

- export page loads
- downloads start successfully
- exported data matches the app

### Any other export entry points

If the current release includes other export buttons on analytics or reporting pages:

1. Trigger each one once.
2. Confirm the browser download starts.
3. Open the file and spot-check the data shape.

Expected result:

- export actions do not fail silently
- the file is readable and not obviously empty or malformed

## 7. Admin Oversight

Use an admin account.

1. Open `Admin Dashboard`.
2. Confirm the overview cards load counts for:
   - users
   - lecturers
   - students
   - assignments
   - submissions
   - moderation cases
3. Click the user-related cards:
   - Total Users
   - Lecturers
   - Students
4. Confirm the correct user list or filter opens.
5. Open the read-only admin assignments view.
6. Open the read-only admin submissions view.
7. Confirm these views show data without exposing lecturer mutation controls.
8. If the environment has the audit migration applied, open `Audit Log` and confirm entries appear after a role change.

Expected result:

- admin overview counts load
- user filters behave as expected
- assignments and submissions oversight views are readable and clearly admin-safe
- the audit view is useful where the migration is live, and harmless where it is not

## 8. Error Handling

This section is not about breaking the app on purpose. It is about checking that ordinary failures fail cleanly.

### Network interruption

1. Open a page that fetches live data, such as Assignments or Moderation.
2. Temporarily disconnect the network or block requests in the browser devtools.
3. Refresh the page.
4. Restore the network.
5. Reload again.

Expected result:

- the app shows a recoverable loading or error state
- it does not get stuck permanently after connectivity returns

### Bad or missing data

Check at least one page from each group:

- assignment detail
- moderation dashboard
- an analytics page

What to look for:

- no hard crash when a related record is missing
- fallback labels appear where the code already supports them
- action buttons are disabled when the required backing data is missing

### Permission failures

Use the wrong role on purpose where it is safe to do so.

1. As a student, try to reach a lecturer-only route directly by URL.
2. As a lecturer who does not own a workflow item, try to perform an owner-only action if the environment allows it.

Expected result:

- unauthorized pages do not expose sensitive data
- protected actions fail safely instead of half-saving

## 9. Final Pre-Release Pass

Before calling the build ready, confirm all of these are true:

- login works for both lecturer and student roles
- a lecturer can create and publish an assignment
- a student can submit work to a published assignment
- the lecturer can see and process that submission
- moderation still works for a real case
- analytics pages load without obvious errors
- admin dashboard and user management load if admin is part of the release scope
- exports download and contain sensible data
- common failure cases do not crash the app

## 10. Stop Conditions

Do not ship or demo if any of these are true:

- users cannot log in reliably
- a student can see unreleased grades
- a lecturer cannot see their own submissions or moderation cases
- moderation actions fail because of permissions or missing joins
- analytics pages throw runtime errors on normal data
- admin landing pages are blank because of missing environment-specific schema or migration drift
- export downloads are empty, broken, or obviously inaccurate
- a page crashes instead of showing a fallback or error state
