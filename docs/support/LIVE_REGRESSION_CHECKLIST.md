# Live Regression Checklist

Use this as a short post-change smoke test across the highest-value workflows.

Goal:
- confirm the recent grading, notification, authorization, and dashboard changes did not break normal usage
- catch obvious regressions before demo, review, or pilot use

## Preconditions

- latest frontend build is deployed or running locally
- latest Supabase migrations are applied to the target project
- changed Edge Functions are deployed
- you have access to:
  - one lecturer account
  - one student account
  - one moderator-capable lecturer account if moderation is separate
  - one admin account

## 1. Lecturer Flow

As a lecturer:

1. Open `Assignments`
2. Create or open a published assignment
3. Confirm the assignment detail page loads
4. Confirm submissions list, integrity card, and workflow actions render
5. Trigger AI grading on one submission, including a code file if available
6. Confirm the submission moves through grading without getting stuck
7. Save lecturer review
8. Approve and release the grade if moderation is not required

Expected:
- assignment pages load normally
- AI grading completes
- lecturer review persists
- release works without runtime or permission errors

## 2. Student Flow

As a student:

1. Open `Assignments`
2. Confirm only targeted/open assignments are visible
3. Submit work to a published assignment
4. Refresh and confirm the submission persists
5. After lecturer release, open `Student Grades`
6. Confirm the released grade is visible
7. Open `Explain My Grade`

Expected:
- submission works and persists
- unreleased grades are not shown
- released grades are visible
- `Explain My Grade` opens and responds safely

## 3. Moderation Flow

As a lecturer or moderator:

1. Use a submission that requires moderation
2. Confirm it moves to `moderation_pending`
3. Open `Moderation`
4. Confirm the case appears in the queue
5. Assign a moderator if required
6. Complete one moderation action such as `agree` or `adjust`
7. Return to the lecturer workflow and confirm approval is available only after moderation is complete

Expected:
- moderation queue loads
- moderation actions persist
- premature approval is blocked

## 4. Admin Flow

As an admin:

1. Open `Admin Dashboard`
2. Confirm overview counts load
3. Open user, assignment, and submission oversight views
4. Confirm pages load without blank states or obvious permission errors

Expected:
- admin overview renders
- oversight pages are readable
- no lecturer-only mutation controls leak into admin-safe views unless intentionally designed

## 5. Integrity Flow

As a lecturer:

1. Open `Academic Integrity`
2. Review one flagged case if available
3. Save an integrity decision and note
4. Open one assignment detail integrity card
5. If the card is in a clear/no-issue state, click `Clear`

Expected:
- integrity queue loads
- integrity decision persists
- integrity card dismiss/clear works

## 6. Notification Flow

As any role that can receive notifications:

1. Trigger a bell notification through a normal workflow event
2. Open the notification menu
3. Confirm the new notification appears
4. Click `Clear`

Expected:
- notification is visible
- clear action succeeds
- no `communication_messages` permission or recursion error appears

## 7. Regression Stop Conditions

Treat the build as not ready if any of these happen:

- AI grading gets stuck or throws a live function error
- students can see unreleased grades
- moderation no longer blocks approval correctly
- bell notification clear fails
- integrity save or clear fails
- admin pages blank or crash on normal data
- assignment detail fails to load for the owning lecturer
