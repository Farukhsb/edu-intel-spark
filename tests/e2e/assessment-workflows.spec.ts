import { expect, test } from "@playwright/test";
import { setE2EAuth } from "./helpers/auth";
import { createMockSupabaseState, installSupabaseMocks } from "./helpers/mockSupabase";

const lecturer = {
  id: "lecturer-1",
  email: "lecturer@gradeai.test",
  fullName: "Dr. Ada Lecturer",
};

const moderator = {
  id: "lecturer-2",
  email: "moderator@gradeai.test",
  fullName: "Prof. Mina Moderator",
};

const student = {
  id: "student-1",
  email: "student@gradeai.test",
  fullName: "Sam Student",
};

test.describe("critical assessment workflows", () => {
  test("lecturer can review, approve, and release a graded submission", async ({ page }) => {
    const state = createMockSupabaseState({
      assignments: [
        {
          id: "assignment-release",
          title: "Algorithms Essay",
          description: "Essay on algorithmic fairness.",
          module_code: "CS401",
          max_score: 100,
          due_date: "2026-04-10T09:00:00.000Z",
          status: "published",
          lecturer_id: lecturer.id,
          rubric: [{ criterion: "Analysis", weight: 50 }],
        },
      ],
      submissions: [
        {
          id: "submission-release",
          assignment_id: "assignment-release",
          student_name: student.fullName,
          student_email: student.email,
          student_id: student.id,
          file_name: "algorithms-essay.pdf",
          file_type: "application/pdf",
          file_url: "student-1/assignment-release/essay.pdf",
          status: "ai_graded",
          submitted_at: "2026-04-09T10:00:00.000Z",
          uploaded_by: student.id,
        },
      ],
      grades: [
        {
          id: "grade-release",
          submission_id: "submission-release",
          ai_score: 68,
          ai_feedback: "Strong argument with limited engagement with counterpoints.",
          ai_breakdown: [{ criterion: "Analysis", score: 34, max_score: 50, confidence_score: 0.84 }],
          grading_confidence: 0.84,
          grading_metadata: {},
          lecturer_score: null,
          lecturer_feedback: null,
          final_score: null,
          final_feedback: null,
        },
      ],
      academic_integrity_reviews: [],
      moderation_cases: [],
      moderation_reviews: [],
      grade_audit_log: [],
      profiles: [
        { id: lecturer.id, full_name: lecturer.fullName, email: lecturer.email, role: "lecturer", avatar_url: null, cohort_id: null, department_id: null },
      ],
    });

    await installSupabaseMocks(page, state);
    await setE2EAuth(page, { role: "lecturer", ...lecturer });

    await page.goto("/dashboard/assignments/assignment-release");
    await expect(page.getByText("Algorithms Essay")).toBeVisible();
    const submissionCard = page.getByTestId("submission-card-submission-release");

    await page.getByTestId("submission-review-submission-release").click();
    await expect(page.getByTestId("submission-review-dialog")).toBeVisible();
    await page.getByPlaceholder(/out of 100/i).fill("73");
    await page.getByPlaceholder(/add or edit feedback/i).fill("Clearer use of evidence after lecturer review.");
    await page.getByTestId("submission-review-save").click();

    await expect(page.getByTestId("submission-review-dialog")).not.toBeVisible();
    await expect(page.getByTestId("submission-status-submission-release")).toContainText("First Review");
    await expect(submissionCard).toContainText("73/100");

    await page.getByTestId("submission-approve-submission-release").click();
    await expect(page.getByTestId("submission-status-submission-release")).toContainText("Approved");
    await expect(page.getByTestId("submission-release-submission-release")).toBeVisible();

    await page.getByTestId("submission-release-submission-release").click();
    await expect(page.getByTestId("submission-status-submission-release")).toContainText("Released");

    expect(state.tables.submissions[0].status).toBe("released");
    expect(state.tables.grades[0].final_score).toBe(73);
    expect(state.tables.communication_messages).toHaveLength(1);
    expect(state.tables.communication_messages[0].category).toBe("grade-released");
    expect(state.tables.communication_messages[0].subject).toBe("Feedback released");
    expect(state.tables.communication_messages[0].body).toBe("Your feedback for Algorithms Essay is now available");
  });

  test("moderation required blocks approval until a moderator completes the case", async ({ page }) => {
    const state = createMockSupabaseState({
      assignments: [
        {
          id: "assignment-moderation",
          title: "Policy Case Study",
          description: "Moderation-heavy case study.",
          module_code: "POL305",
          max_score: 100,
          due_date: "2026-04-10T09:00:00.000Z",
          status: "published",
          lecturer_id: lecturer.id,
          rubric: [{ criterion: "Argument", weight: 50 }],
        },
      ],
      submissions: [
        {
          id: "submission-moderation",
          assignment_id: "assignment-moderation",
          student_name: student.fullName,
          student_email: student.email,
          student_id: student.id,
          file_name: "policy-case-study.pdf",
          file_type: "application/pdf",
          file_url: "student-1/assignment-moderation/case-study.pdf",
          status: "ai_graded",
          submitted_at: "2026-04-09T11:00:00.000Z",
          uploaded_by: student.id,
        },
      ],
      grades: [
        {
          id: "grade-moderation",
          submission_id: "submission-moderation",
          ai_score: 54,
          ai_feedback: "Borderline but passable argument.",
          ai_breakdown: [{ criterion: "Argument", score: 27, max_score: 50, confidence_score: 0.61 }],
          grading_confidence: 0.61,
          grading_metadata: {},
          lecturer_score: null,
          lecturer_feedback: null,
          final_score: null,
          final_feedback: null,
        },
      ],
      academic_integrity_reviews: [],
      moderation_cases: [],
      moderation_reviews: [],
      grade_audit_log: [],
      profiles: [
        { id: lecturer.id, full_name: lecturer.fullName, email: lecturer.email, role: "lecturer", avatar_url: null, cohort_id: null, department_id: null },
        { id: moderator.id, full_name: moderator.fullName, email: moderator.email, role: "lecturer", avatar_url: null, cohort_id: null, department_id: null },
      ],
    });

    await installSupabaseMocks(page, state);
    await setE2EAuth(page, { role: "lecturer", ...lecturer });

    await page.goto("/dashboard/assignments/assignment-moderation");
    await expect(page.getByText("Policy Case Study")).toBeVisible();
    const moderationSubmissionCard = page.getByTestId("submission-card-submission-moderation");

    await page.getByTestId("submission-review-submission-moderation").click();
    await page.getByPlaceholder(/out of 100/i).fill("72");
    await page.getByPlaceholder(/add or edit feedback/i).fill("Adjusted upward after first marker review.");
    await page.getByTestId("submission-review-save").click();

    await expect(page.getByTestId("submission-review-dialog")).not.toBeVisible();
    await expect(page.getByTestId("submission-status-submission-moderation")).toContainText("Moderation Pending");
    await expect(moderationSubmissionCard).toContainText("72/100");
    expect(state.tables.submissions[0].status).toBe("moderation_pending");
    expect(state.tables.moderation_cases).toHaveLength(1);

    await page.getByTestId("submission-approve-submission-moderation").click();
    await expect(
      page.getByText("This submission is in the moderation workflow and cannot be approved yet.")
    ).toBeVisible();
    expect(state.tables.submissions[0].status).toBe("moderation_pending");

    await page.goto("/dashboard/moderation");
    await expect(page.getByText("Moderation Queue")).toBeVisible();

    await page.getByTestId(`moderation-review-open-${state.tables.moderation_cases[0].id}`).click();
    await expect(page.getByTestId("moderation-review-dialog")).toBeVisible();
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: moderator.fullName }).click();
    await page.getByTestId(`moderation-assign-${state.tables.moderation_cases[0].id}`).click();
    await expect(page.getByText("Moderator assigned.")).toBeVisible();
    expect(state.tables.submissions[0].status).toBe("moderation_in_progress");

    await expect(page.getByTestId("moderation-review-dialog")).toBeVisible();
    await page.getByPlaceholder(/record the moderation rationale/i).fill("Moderator agrees after confirming the lecturer adjustment.");
    await page.getByPlaceholder(/out of 100/i).fill("72");
    await page.getByPlaceholder(/feedback text to keep with the final agreed mark/i).fill("Final agreed feedback after moderation.");
    await page.getByTestId("moderation-action-agree").click();
    await expect(page.getByText("Agree saved.")).toBeVisible();
    expect(state.tables.submissions[0].status).toBe("moderated");

    await page.getByTestId(`moderation-review-open-${state.tables.moderation_cases[0].id}`).click();
    await page.getByTestId("moderation-action-approve").click();
    await expect(page.getByText("Approve saved.")).toBeVisible();

    expect(state.tables.submissions[0].status).toBe("approved");
    expect(state.tables.grades[0].final_score).toBe(72);
    expect(state.tables.moderation_reviews.some((review) => review.action === "agree")).toBeTruthy();
  });

  test("released grades are visible to students while approved grades remain hidden", async ({ page }) => {
    const state = createMockSupabaseState({
      assignments: [
        {
          id: "assignment-visible",
          title: "Released Coursework",
          description: "Visible to students.",
          module_code: "CS500",
          max_score: 100,
          due_date: "2026-04-10T09:00:00.000Z",
          status: "published",
          lecturer_id: lecturer.id,
          rubric: [],
        },
        {
          id: "assignment-hidden",
          title: "Approved Coursework",
          description: "Not yet visible to students.",
          module_code: "CS501",
          max_score: 100,
          due_date: "2026-04-12T09:00:00.000Z",
          status: "published",
          lecturer_id: lecturer.id,
          rubric: [],
        },
      ],
      submissions: [
        {
          id: "submission-visible",
          assignment_id: "assignment-visible",
          student_name: student.fullName,
          student_email: student.email,
          student_id: student.id,
          file_name: "released.pdf",
          file_type: "application/pdf",
          file_url: "student-1/assignment-visible/released.pdf",
          status: "released",
          submitted_at: "2026-04-09T09:00:00.000Z",
          uploaded_by: student.id,
        },
        {
          id: "submission-hidden",
          assignment_id: "assignment-hidden",
          student_name: student.fullName,
          student_email: student.email,
          student_id: student.id,
          file_name: "approved.pdf",
          file_type: "application/pdf",
          file_url: "student-1/assignment-hidden/approved.pdf",
          status: "approved",
          submitted_at: "2026-04-11T09:00:00.000Z",
          uploaded_by: student.id,
        },
      ],
      grades: [
        {
          id: "grade-visible",
          submission_id: "submission-visible",
          ai_score: 70,
          ai_feedback: "Good work.",
          ai_breakdown: [{ criterion: "Analysis", score: 35, max_score: 50 }],
          final_score: 74,
          final_feedback: "Released feedback visible to the student.",
        },
        {
          id: "grade-hidden",
          submission_id: "submission-hidden",
          ai_score: 51,
          ai_feedback: "Draft feedback.",
          ai_breakdown: [{ criterion: "Argument", score: 25, max_score: 50 }],
          final_score: 55,
          final_feedback: "Approved feedback should stay hidden.",
        },
      ],
      profiles: [
        { id: student.id, full_name: student.fullName, email: student.email, role: "student", avatar_url: null, cohort_id: "cohort-1", department_id: "cs" },
      ],
    });

    await installSupabaseMocks(page, state);
    await setE2EAuth(page, { role: "student", ...student, cohortId: "cohort-1", departmentId: "cs" });

    await page.goto("/dashboard");
    await expect(page.getByText("Your grade view")).toBeVisible();

    const releasedCard = page.locator("div").filter({ hasText: "Released Coursework" }).first();
    await expect(releasedCard).toContainText("74/100");
    await expect(releasedCard).toContainText("Released feedback visible to the student.");

    const approvedCard = page.locator("div").filter({ hasText: "Approved Coursework" }).first();
    await expect(approvedCard).toContainText("approved");
    await expect(approvedCard).not.toContainText("55/100");
    await expect(approvedCard).not.toContainText("Approved feedback should stay hidden.");
  });
});
