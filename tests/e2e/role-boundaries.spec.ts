import { expect, test } from "@playwright/test";
import { setE2EAuth } from "./helpers/auth";
import { createMockSupabaseState, installSupabaseMocks } from "./helpers/mockSupabase";

const lecturer = {
  id: "lecturer-1",
  email: "lecturer@gradeai.test",
  fullName: "Dr. Ada Lecturer",
};

const otherLecturer = {
  id: "lecturer-2",
  email: "other-lecturer@gradeai.test",
  fullName: "Prof. Mina Other",
};

const student = {
  id: "student-1",
  email: "student@gradeai.test",
  fullName: "Sam Student",
};

test.describe("role boundary workflows", () => {
  test("student is shown access denied for lecturer-only integrity routes", async ({ page }) => {
    const state = createMockSupabaseState({
      profiles: [
        {
          id: student.id,
          full_name: student.fullName,
          email: student.email,
          role: "student",
          avatar_url: null,
          cohort_id: "cohort-1",
          department_id: "cs",
        },
      ],
    });

    await installSupabaseMocks(page, state);
    await setE2EAuth(page, { role: "student", ...student, cohortId: "cohort-1", departmentId: "cs" });

    await page.goto("/dashboard/integrity");
    await expect(page.getByText("Access denied")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("You don't have access to this area.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to dashboard" })).toBeVisible();
    await expect(page.getByText("Academic Integrity Review Queue")).not.toBeVisible();
  });

  test("lecturer cannot open another lecturer's assignment detail directly", async ({ page }) => {
    const state = createMockSupabaseState({
      assignments: [
        {
          id: "assignment-foreign",
          title: "Foreign Assignment",
          description: "Owned by another lecturer.",
          module_code: "CS999",
          max_score: 100,
          due_date: "2026-04-10T09:00:00.000Z",
          status: "published",
          lecturer_id: otherLecturer.id,
          rubric: [],
        },
      ],
      profiles: [
        {
          id: lecturer.id,
          full_name: lecturer.fullName,
          email: lecturer.email,
          role: "lecturer",
          avatar_url: null,
          cohort_id: null,
          department_id: null,
        },
      ],
    });

    await installSupabaseMocks(page, state);
    await setE2EAuth(page, { role: "lecturer", ...lecturer });

    await page.goto("/dashboard/assignments/assignment-foreign");
    await expect(page.getByText("Assignment not found or access denied")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Foreign Assignment")).not.toBeVisible();
  });

  test("lecturer cannot open a student profile outside their assignment ownership", async ({ page }) => {
    const state = createMockSupabaseState({
      assignments: [
        {
          id: "assignment-other-owner",
          title: "Other Lecturer Assignment",
          description: "Not visible to the signed-in lecturer.",
          module_code: "POL400",
          max_score: 100,
          due_date: "2026-04-10T09:00:00.000Z",
          status: "published",
          lecturer_id: otherLecturer.id,
          rubric: [],
        },
      ],
      submissions: [
        {
          id: "submission-other-owner",
          assignment_id: "assignment-other-owner",
          student_name: student.fullName,
          student_email: student.email,
          student_id: student.id,
          status: "submitted",
          submitted_at: "2026-04-09T09:00:00.000Z",
          uploaded_by: student.id,
        },
      ],
      profiles: [
        {
          id: lecturer.id,
          full_name: lecturer.fullName,
          email: lecturer.email,
          role: "lecturer",
          avatar_url: null,
          cohort_id: null,
          department_id: null,
        },
      ],
    });

    await installSupabaseMocks(page, state);
    await setE2EAuth(page, { role: "lecturer", ...lecturer });

    await page.goto(`/dashboard/student/${student.id}`);
    await expect(page.getByText("Student not found for this lecturer view.")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(student.fullName)).not.toBeVisible();
  });

  test("student cannot open explain-grade details for unreleased work", async ({ page }) => {
    const state = createMockSupabaseState({
      assignments: [
        {
          id: "assignment-unreleased",
          title: "Awaiting Release Coursework",
          description: "Approved but not released.",
          module_code: "CS502",
          max_score: 100,
          due_date: "2026-04-12T09:00:00.000Z",
          status: "published",
          lecturer_id: lecturer.id,
          rubric: [],
        },
      ],
      submissions: [
        {
          id: "submission-unreleased",
          assignment_id: "assignment-unreleased",
          student_name: student.fullName,
          student_email: student.email,
          student_id: student.id,
          file_name: "awaiting-release.pdf",
          file_type: "application/pdf",
          file_url: "student-1/assignment-unreleased/awaiting-release.pdf",
          status: "approved",
          submitted_at: "2026-04-11T09:00:00.000Z",
          uploaded_by: student.id,
        },
      ],
      grades: [
        {
          id: "grade-unreleased",
          submission_id: "submission-unreleased",
          ai_score: 51,
          ai_feedback: "Unreleased private AI feedback",
          ai_breakdown: [{ criterion: "Argument", score: 25, max_score: 50 }],
          final_score: 55,
          final_feedback: "Approved feedback should stay hidden.",
        },
      ],
      profiles: [
        {
          id: student.id,
          full_name: student.fullName,
          email: student.email,
          role: "student",
          avatar_url: null,
          cohort_id: "cohort-1",
          department_id: "cs",
        },
      ],
    });

    await installSupabaseMocks(page, state);
    await setE2EAuth(page, { role: "student", ...student, cohortId: "cohort-1", departmentId: "cs" });

    await page.goto("/dashboard/explain-grade?assignment=assignment-unreleased&submission=submission-unreleased");
    await expect(page.getByText("Your results are on the way")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Unreleased private AI feedback")).not.toBeVisible();
    await expect(page.getByText("Approved feedback should stay hidden.")).not.toBeVisible();
  });

  test("lecturer does not see integrity cases owned by another lecturer", async ({ page }) => {
    const state = createMockSupabaseState({
      assignments: [
        {
          id: "assignment-other-integrity",
          title: "Other Lecturer Integrity Case",
          lecturer_id: otherLecturer.id,
        },
      ],
      submissions: [
        {
          id: "submission-other-integrity",
          assignment_id: "assignment-other-integrity",
          student_name: student.fullName,
          student_email: student.email,
          student_id: student.id,
          status: "submitted",
          submitted_at: "2026-04-20T10:00:00.000Z",
        },
      ],
      academic_integrity_reviews: [
        {
          id: "review-other-integrity",
          submission_id: "submission-other-integrity",
          lecturer_id: otherLecturer.id,
          review_type: "similarity-plagiarism-suspicion",
          decision: "investigate",
          lecturer_note: JSON.stringify({
            latestNote: "Other lecturer case.",
            history: [],
            integritySnapshot: null,
          }),
          updated_at: "2026-04-20T12:00:00.000Z",
        },
      ],
      profiles: [
        {
          id: lecturer.id,
          full_name: lecturer.fullName,
          email: lecturer.email,
          role: "lecturer",
          avatar_url: null,
          cohort_id: null,
          department_id: null,
        },
      ],
    });

    await installSupabaseMocks(page, state);
    await setE2EAuth(page, { role: "lecturer", ...lecturer });

    await page.goto("/dashboard/integrity");
    await expect(page.getByText("Academic Integrity Review Queue")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("No persisted integrity cases found yet. Run a plagiarism check on an assignment to populate the queue.")).toBeVisible();
    await expect(page.getByText(student.fullName)).not.toBeVisible();
  });

  test("lecturer does not see moderation cases owned by another lecturer", async ({ page }) => {
    const state = createMockSupabaseState({
      assignments: [
        {
          id: "assignment-other-moderation",
          title: "Other Lecturer Moderation Case",
          lecturer_id: otherLecturer.id,
        },
      ],
      submissions: [
        {
          id: "submission-other-moderation",
          assignment_id: "assignment-other-moderation",
          student_name: student.fullName,
          student_email: student.email,
          student_id: student.id,
          status: "moderation_pending",
          submitted_at: "2026-04-20T10:00:00.000Z",
        },
      ],
      grades: [
        {
          id: "grade-other-moderation",
          submission_id: "submission-other-moderation",
          ai_score: 58,
          ai_feedback: "Requires moderation.",
          final_score: null,
          final_feedback: null,
        },
      ],
      moderation_cases: [
        {
          id: "case-other-moderation",
          submission_id: "submission-other-moderation",
          assignment_id: "assignment-other-moderation",
          grade_id: "grade-other-moderation",
          lecturer_id: otherLecturer.id,
          first_marker_id: otherLecturer.id,
          moderator_id: null,
          status: "moderation_pending",
          trigger_flags: ["borderline"],
          trigger_summary: "Other lecturer case",
          confidence_score: 0.62,
          integrity_risk_score: 0,
          ai_score_snapshot: 58,
          first_marker_score: 62,
          moderator_score: null,
          final_agreed_score: null,
          final_agreed_feedback: null,
          moderated_at: null,
          approved_at: null,
          created_at: "2026-04-20T10:30:00.000Z",
          updated_at: "2026-04-20T10:30:00.000Z",
        },
      ],
      profiles: [
        {
          id: lecturer.id,
          full_name: lecturer.fullName,
          email: lecturer.email,
          role: "lecturer",
          avatar_url: null,
          cohort_id: null,
          department_id: null,
        },
      ],
    });

    await installSupabaseMocks(page, state);
    await setE2EAuth(page, { role: "lecturer", ...lecturer });

    await page.goto("/dashboard/moderation");
    await expect(page.getByText("Moderation Queue")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("No moderation cases match the current search and filter.")).toBeVisible();
    await expect(page.getByText(student.fullName)).not.toBeVisible();
  });

  test("student is shown access denied on the lecturer-only student profile route", async ({ page }) => {
    const state = createMockSupabaseState({
      profiles: [
        {
          id: student.id,
          full_name: student.fullName,
          email: student.email,
          role: "student",
          avatar_url: null,
          cohort_id: "cohort-1",
          department_id: "cs",
        },
      ],
    });

    await installSupabaseMocks(page, state);
    await setE2EAuth(page, { role: "student", ...student, cohortId: "cohort-1", departmentId: "cs" });

    await page.goto(`/dashboard/student/${student.id}`);
    await expect(page.getByText("Access denied")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("You don't have access to this area.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to dashboard" })).toBeVisible();
    await expect(page.getByText("Student not found for this lecturer view.")).not.toBeVisible();
  });
});
