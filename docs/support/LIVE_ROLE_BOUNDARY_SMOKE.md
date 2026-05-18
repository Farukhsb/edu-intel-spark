# Live Role-Boundary Smoke Checklist

Use this checklist against the live or staging deployment after applying the latest Supabase migrations.

Goal:
- prove the highest-trust lecturer/student access boundaries still hold
- verify the core assessment lifecycle remains consistent in the real environment
- catch RLS or permissions drift before presentation or pilot use

## Preconditions

- backend migrations are applied to the target Supabase project
- latest frontend bundle is deployed
- Edge Functions are deployed for any changed function code
- you have:
  - one lecturer account
  - one moderator-capable lecturer account if moderation is assigned separately
  - one student account
  - at least one assignment with test submissions

## 1. Lecturer Assignment Ownership

As lecturer A:
- open `/dashboard/assignments`
- confirm only lecturer A’s assignments are visible
- open one assignment detail page
- confirm submissions, grades, integrity results, and moderation actions load normally

As lecturer B:
- try to access lecturer A’s assignment detail route directly
- expected:
  - assignment data is not exposed
  - grading/release/moderation actions are not available for lecturer A’s work

## 2. Student Visibility Boundary

Prepare:
- one submission with status `approved`
- one submission with status `released`

As the student:
- open the student dashboard
- expected:
  - released grade is visible
  - approved-but-not-released grade is not shown as a final visible result

## 3. Lecturer Review -> Approve -> Release

As the owning lecturer:
- open a submission already AI graded and not requiring moderation
- save first review
- approve the grade
- release the grade

Expected:
- status transitions correctly through the workflow
- no moderation case is created for the non-moderated path
- final grade becomes visible to the student only after release

## 4. Moderation Gating

As the owning lecturer:
- use a submission that triggers moderation
- save first review

Expected:
- submission moves to `moderation_pending`
- direct approval is blocked until moderation is completed
- moderation case is visible in `/dashboard/moderation`

As the moderator / assigned lecturer:
- assign moderator if required
- complete a moderation action such as `agree` or `adjust`

Expected:
- submission moves through the moderation workflow
- lecturer can approve only after the moderation outcome exists

## 5. Recommendation Ownership

As lecturer A:
- open `/dashboard/cohort-analytics`
- confirm recommendations load
- review or dismiss one recommendation

Expected:
- recommendation state persists across reloads
- recommendation actions do not affect another lecturer’s recommendation set

As lecturer B:
- open lecturer B’s analytics
- expected:
  - lecturer A’s persisted recommendations or actions are not visible

## 6. Integrity Review Ownership

As the owning lecturer:
- open `/dashboard/integrity`
- review one flagged case
- save a decision and note

Expected:
- save succeeds
- decision persists across reload
- history/note is visible to the owning lecturer

As a different lecturer:
- try to access or query the same integrity case through the UI
- expected:
  - the review record is not exposed unless that lecturer owns the underlying assignment

## 7. Student Intervention Ownership

As the owning lecturer:
- open a student profile
- create an intervention

Expected:
- intervention appears in the lecturer’s intervention history
- related student profile still loads normally

As a different lecturer:
- confirm the same intervention is not exposed through that lecturer’s student view

## 8. Audit Surface Smoke

As the owning lecturer:
- perform one grading approval
- perform one moderation action if available

Expected:
- the relevant workflow still completes
- moderation dashboard audit/history surfaces load without runtime failure
- no permission errors appear in the browser console for audit reads

## Pass / Fail Rule

Pass this smoke only if:
- lecturer B cannot see or act on lecturer A’s protected data
- students only see released grades
- moderation still blocks premature approval
- integrity decisions persist correctly
- recommendation state persists per lecturer
- no route crashes or permission errors appear during the checks

If any one of those fails, treat the environment as not release-ready until the boundary is fixed and re-tested.
