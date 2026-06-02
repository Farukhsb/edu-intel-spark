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

const dismissLecturerOnboarding = async (page: { addInitScript: (arg: (storageKey: string) => void, storageKey: string) => Promise<void> }) => {
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(storageKey, "true");
  }, "gradeai:lecturer-onboarding-v1-dismissed");
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
    await dismissLecturerOnboarding(page);

    await page.goto("/dashboard/assignments/assignment-release");
    await page.waitForURL("**/dashboard/assignments/assignment-release");
    await expect(page.getByText("Algorithms Essay")).toBeVisible({ timeout: 10000 });
    const submissionCard = page.getByTestId("submission-card-submission-release");

    await page.getByTestId("submission-review-submission-release").click();
    await expect(page.getByTestId("submission-review-dialog")).toBeVisible();
    await page.getByPlaceholder(/out of 100/i).fill("73");
    await page.getByPlaceholder(/add or edit feedback/i).fill("Clearer use of evidence after lecturer review.");
    await page.getByTestId("submission-review-save").click();

    await expect(page.getByText("First marker review saved.")).toBeVisible();
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
    await dismissLecturerOnboarding(page);

    await page.goto("/dashboard/assignments/assignment-moderation");
    await page.waitForURL("**/dashboard/assignments/assignment-moderation");
    await expect(page.getByText("Policy Case Study")).toBeVisible({ timeout: 10000 });
    const moderationSubmissionCard = page.getByTestId("submission-card-submission-moderation");

    await page.getByTestId("submission-review-submission-moderation").click();
    await page.getByPlaceholder(/out of 100/i).fill("72");
    await page.getByPlaceholder(/add or edit feedback/i).fill("Adjusted upward after first marker review.");
    await page.getByTestId("submission-review-save").click();

    await expect(page.getByText("First marker review saved.")).toBeVisible();
    await expect(page.getByTestId("submission-review-dialog")).not.toBeVisible();
    await expect(page.getByTestId("submission-status-submission-moderation")).toContainText("First Review");
    await expect(moderationSubmissionCard).toContainText("72/100");
    expect(state.tables.submissions[0].status).toBe("first_review");
    expect(state.tables.moderation_cases).toHaveLength(0);
    await page.getByRole("button", { name: "Send to moderation" }).click();
    await expect.poll(() => state.tables.submissions[0].status).toBe("moderation_pending");
    await expect.poll(() => state.tables.moderation_cases.length).toBe(1);
    await expect(page.getByTestId("submission-approve-submission-moderation")).toHaveCount(0);
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

    await setE2EAuth(page, { role: "lecturer", ...moderator });

    await page.reload();
    await expect(page.getByText("Moderation Queue")).toBeVisible();
    await page.getByTestId(`moderation-review-open-${state.tables.moderation_cases[0].id}`).click();
    await page.getByPlaceholder(/record the moderation rationale/i).fill("Moderator agrees after confirming the lecturer adjustment.");
    await page.getByPlaceholder(/out of 100/i).fill("72");
    await page.getByPlaceholder(/feedback text to keep with the final agreed mark/i).fill("Final agreed feedback after moderation.");
    await page.getByTestId("moderation-action-agree").click();
    await expect(page.getByText("Agree saved.")).toBeVisible();
    expect(state.tables.submissions[0].status).toBe("moderated");

    await setE2EAuth(page, { role: "lecturer", ...lecturer });

    await page.reload();
    await expect(page.getByText("Moderation Queue")).toBeVisible();
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
    await page.waitForURL("**/dashboard");
    await expect(page.getByText("Your results, Sam")).toBeVisible({ timeout: 10000 });

    await expect(page.getByText("Released Coursework — 74%", { exact: true })).toBeVisible();
    await expect(page.getByText("Released feedback visible to the student.")).toBeVisible();

    await expect(page.getByText("Approved Coursework")).toHaveCount(0);
  });

  test("student only sees the result after lecturer release changes status from approved to released", async ({ page }) => {
    const state = createMockSupabaseState({
      assignments: [
        {
          id: "assignment-transition",
          title: "Operating Systems Report",
          description: "Release visibility transition coverage.",
          module_code: "CS430",
          max_score: 100,
          due_date: "2026-04-14T09:00:00.000Z",
          status: "published",
          lecturer_id: lecturer.id,
          rubric: [{ criterion: "Evaluation", weight: 50 }],
        },
      ],
      submissions: [
        {
          id: "submission-transition",
          assignment_id: "assignment-transition",
          student_name: student.fullName,
          student_email: student.email,
          student_id: student.id,
          file_name: "os-report.pdf",
          file_type: "application/pdf",
          file_url: "student-1/assignment-transition/os-report.pdf",
          status: "ai_graded",
          submitted_at: "2026-04-13T10:30:00.000Z",
          uploaded_by: student.id,
        },
      ],
      grades: [
        {
          id: "grade-transition",
          submission_id: "submission-transition",
          ai_score: 76,
          ai_feedback: "Secure knowledge with a solid evaluative line.",
          ai_breakdown: [{ criterion: "Evaluation", score: 38, max_score: 50, confidence_score: 0.92 }],
          grading_confidence: 0.92,
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
        { id: student.id, full_name: student.fullName, email: student.email, role: "student", avatar_url: null, cohort_id: "cohort-1", department_id: "cs" },
      ],
    });

    await installSupabaseMocks(page, state);
    await setE2EAuth(page, { role: "lecturer", ...lecturer });
    await dismissLecturerOnboarding(page);

    await page.goto("/dashboard/assignments/assignment-transition");
    await page.waitForURL("**/dashboard/assignments/assignment-transition");
    await expect(page.getByText("Operating Systems Report")).toBeVisible({ timeout: 10000 });

    await page.getByTestId("submission-review-submission-transition").click();
    await expect(page.getByTestId("submission-review-dialog")).toBeVisible();
    await page.getByPlaceholder(/out of 100/i).fill("78");
    await page.getByPlaceholder(/add or edit feedback/i).fill("Clearer systems evaluation after lecturer review.");
    await page.getByTestId("submission-review-save").click();
    await expect(page.getByText("First marker review saved.")).toBeVisible();

    await page.getByTestId("submission-approve-submission-transition").click();
    await expect(page.getByTestId("submission-status-submission-transition")).toContainText("Approved");
    expect(state.tables.submissions[0].status).toBe("approved");

    await setE2EAuth(page, { role: "student", ...student, cohortId: "cohort-1", departmentId: "cs" });
    await page.goto("/dashboard");
    await page.waitForURL("**/dashboard");
    await expect(page.getByText("Your results are on the way")).toBeVisible({ timeout: 10000 });

    await expect(page.getByText("Operating Systems Report")).toHaveCount(0);

    await setE2EAuth(page, { role: "lecturer", ...lecturer });
    await page.goto("/dashboard/assignments/assignment-transition");
    await page.waitForURL("**/dashboard/assignments/assignment-transition");
    await page.getByTestId("submission-release-submission-transition").click();
    await expect(page.getByTestId("submission-status-submission-transition")).toContainText("Released");
    expect(state.tables.submissions[0].status).toBe("released");

    await setE2EAuth(page, { role: "student", ...student, cohortId: "cohort-1", departmentId: "cs" });
    await page.goto("/dashboard");
    await page.waitForURL("**/dashboard");

    await expect(page.getByText("Operating Systems Report — 78%", { exact: true })).toBeVisible();
    await expect(page.getByText("Clearer systems evaluation after lecturer review.")).toBeVisible();
  });

  test("older lecturer notification focus falls forward to released follow-up once the workflow is already released", async ({ page }) => {
    const state = createMockSupabaseState({
      assignments: [
        {
          id: "assignment-notice-forward",
          title: "Distributed Systems Portfolio",
          description: "Notification focus reconciliation coverage.",
          module_code: "CS440",
          max_score: 100,
          due_date: "2026-04-18T09:00:00.000Z",
          status: "published",
          lecturer_id: lecturer.id,
          rubric: [],
        },
      ],
      submissions: [
        {
          id: "submission-released-focus",
          assignment_id: "assignment-notice-forward",
          student_name: "Amina Hassan",
          student_email: "amina@example.test",
          student_id: "student-focus-1",
          file_name: "released-focus.pdf",
          file_type: "application/pdf",
          file_url: "student-focus-1/assignment-notice-forward/released-focus.pdf",
          status: "released",
          submitted_at: "2026-04-17T10:00:00.000Z",
          uploaded_by: "student-focus-1",
        },
        {
          id: "submission-stale-review",
          assignment_id: "assignment-notice-forward",
          student_name: "Daniel Reed",
          student_email: "daniel@example.test",
          student_id: "student-focus-2",
          file_name: "stale-review.pdf",
          file_type: "application/pdf",
          file_url: "student-focus-2/assignment-notice-forward/stale-review.pdf",
          status: "submitted",
          submitted_at: "2026-04-17T11:00:00.000Z",
          uploaded_by: "student-focus-2",
        },
      ],
      grades: [
        {
          id: "grade-released-focus",
          submission_id: "submission-released-focus",
          ai_score: 72,
          ai_feedback: "Released report feedback.",
          ai_breakdown: [],
          final_score: 75,
          final_feedback: "Released portfolio feedback.",
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
    await dismissLecturerOnboarding(page);

    await page.goto("/dashboard/assignments/assignment-notice-forward?source=notification&focus=submission-review");
    await page.waitForURL("**/dashboard/assignments/assignment-notice-forward?source=notification&focus=submission-review");
    await expect(page.getByTestId("assignment-notification-focus")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("assignment-notification-focus")).toContainText(
      "Opened from an earlier notice after release",
    );
    await expect(page.getByTestId("assignment-notification-focus")).toContainText("released results");

    await expect(page.getByTestId("submission-card-submission-released-focus")).toBeVisible();
    await expect(page.getByTestId("submission-card-submission-released-focus")).toContainText("Released");
    await expect(page.getByTestId("submission-card-submission-stale-review")).toHaveCount(0);
  });

  test("older lecturer AI-results notice falls forward into moderation once moderation is the active stage", async ({ page }) => {
    const state = createMockSupabaseState({
      assignments: [
        {
          id: "assignment-notice-moderation",
          title: "Computer Networks Review",
          description: "Moderation notification reconciliation coverage.",
          module_code: "CS450",
          max_score: 100,
          due_date: "2026-04-19T09:00:00.000Z",
          status: "published",
          lecturer_id: lecturer.id,
          rubric: [],
        },
      ],
      submissions: [
        {
          id: "submission-moderation-focus-1",
          assignment_id: "assignment-notice-moderation",
          student_name: "Amina Hassan",
          student_email: "amina@example.test",
          student_id: "student-mod-focus-1",
          file_name: "moderation-focus-1.pdf",
          file_type: "application/pdf",
          file_url: "student-mod-focus-1/assignment-notice-moderation/moderation-focus-1.pdf",
          status: "moderation_pending",
          submitted_at: "2026-04-18T10:00:00.000Z",
          uploaded_by: "student-mod-focus-1",
        },
        {
          id: "submission-moderation-focus-2",
          assignment_id: "assignment-notice-moderation",
          student_name: "Daniel Reed",
          student_email: "daniel@example.test",
          student_id: "student-mod-focus-2",
          file_name: "moderation-focus-2.pdf",
          file_type: "application/pdf",
          file_url: "student-mod-focus-2/assignment-notice-moderation/moderation-focus-2.pdf",
          status: "escalated",
          submitted_at: "2026-04-18T11:00:00.000Z",
          uploaded_by: "student-mod-focus-2",
        },
        {
          id: "submission-stale-ai",
          assignment_id: "assignment-notice-moderation",
          student_name: "Nina Patel",
          student_email: "nina@example.test",
          student_id: "student-mod-focus-3",
          file_name: "stale-ai.pdf",
          file_type: "application/pdf",
          file_url: "student-mod-focus-3/assignment-notice-moderation/stale-ai.pdf",
          status: "ai_graded",
          submitted_at: "2026-04-18T12:00:00.000Z",
          uploaded_by: "student-mod-focus-3",
        },
      ],
      grades: [
        {
          id: "grade-moderation-focus-1",
          submission_id: "submission-moderation-focus-1",
          ai_score: 58,
          ai_feedback: "Queued for moderation.",
          ai_breakdown: [],
          final_score: null,
          final_feedback: null,
        },
        {
          id: "grade-moderation-focus-2",
          submission_id: "submission-moderation-focus-2",
          ai_score: 61,
          ai_feedback: "Escalated after moderation disagreement.",
          ai_breakdown: [],
          final_score: null,
          final_feedback: null,
        },
        {
          id: "grade-stale-ai",
          submission_id: "submission-stale-ai",
          ai_score: 73,
          ai_feedback: "Older AI-ready item.",
          ai_breakdown: [],
          final_score: null,
          final_feedback: null,
        },
      ],
      moderation_cases: [
        {
          id: "case-moderation-focus-1",
          submission_id: "submission-moderation-focus-1",
          assignment_id: "assignment-notice-moderation",
          grade_id: "grade-moderation-focus-1",
          lecturer_id: lecturer.id,
          first_marker_id: lecturer.id,
          moderator_id: null,
          status: "moderation_pending",
          trigger_flags: ["score_variance"],
          trigger_summary: "Needs moderation review.",
          confidence_score: 0.6,
          integrity_risk_score: 0,
          ai_score_snapshot: 58,
          first_marker_score: 70,
          moderator_score: null,
          final_agreed_score: null,
          final_agreed_feedback: null,
          moderated_at: null,
          approved_at: null,
          created_at: "2026-04-18T10:30:00.000Z",
          updated_at: "2026-04-18T10:30:00.000Z",
        },
        {
          id: "case-moderation-focus-2",
          submission_id: "submission-moderation-focus-2",
          assignment_id: "assignment-notice-moderation",
          grade_id: "grade-moderation-focus-2",
          lecturer_id: lecturer.id,
          first_marker_id: lecturer.id,
          moderator_id: lecturer.id,
          status: "escalated",
          trigger_flags: ["integrity_risk"],
          trigger_summary: "Escalated dispute.",
          confidence_score: 0.65,
          integrity_risk_score: 48,
          ai_score_snapshot: 61,
          first_marker_score: 63,
          moderator_score: 60,
          final_agreed_score: null,
          final_agreed_feedback: null,
          moderated_at: null,
          approved_at: null,
          created_at: "2026-04-18T11:30:00.000Z",
          updated_at: "2026-04-18T11:30:00.000Z",
        },
      ],
      academic_integrity_reviews: [],
      moderation_reviews: [],
      grade_audit_log: [],
      profiles: [
        { id: lecturer.id, full_name: lecturer.fullName, email: lecturer.email, role: "lecturer", avatar_url: null, cohort_id: null, department_id: null },
      ],
    });

    await installSupabaseMocks(page, state);
    await setE2EAuth(page, { role: "lecturer", ...lecturer });
    await dismissLecturerOnboarding(page);

    await page.goto("/dashboard/assignments/assignment-notice-moderation?source=notification&focus=ai-results");
    await page.waitForURL("**/dashboard/assignments/assignment-notice-moderation?source=notification&focus=ai-results");
    await expect(page.getByTestId("assignment-notification-focus")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Opened from an earlier notice after moderation started")).toBeVisible();
    await expect(page.getByText("blocked in moderation or escalation")).toBeVisible();

    await expect(page.getByTestId("submission-card-submission-moderation-focus-1")).toBeVisible();
    await expect(page.getByTestId("submission-card-submission-moderation-focus-1")).toContainText("Moderation Pending");
    await expect(page.getByTestId("submission-card-submission-moderation-focus-2")).toBeVisible();
    await expect(page.getByTestId("submission-card-submission-moderation-focus-2")).toContainText("Escalated");
    await expect(page.getByTestId("submission-card-submission-stale-ai")).toHaveCount(0);
  });

});
