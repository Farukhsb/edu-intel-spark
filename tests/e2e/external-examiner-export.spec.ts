import { expect, test } from "@playwright/test";
import { setE2EAuth } from "./helpers/auth";
import { createMockSupabaseState, installSupabaseMocks } from "./helpers/mockSupabase";

const lecturer = {
  id: "lecturer-export-1",
  email: "external.examiner@gradeai.test",
  fullName: "Dr. Eleanor Examiner",
};

test("external examiner export excludes unreleased workflow records", async ({ page }) => {
  const state = createMockSupabaseState({
    assignments: [
      { id: "assignment-released", title: "Released Dissertation", module_code: "CS701" },
      { id: "assignment-approved", title: "Approved Capstone", module_code: "CS702" },
      { id: "assignment-moderated", title: "Moderated Project", module_code: "CS703" },
      { id: "assignment-submitted", title: "Submitted Draft", module_code: "CS704" },
      { id: "assignment-aigraded", title: "AI Graded Draft", module_code: "CS705" },
    ],
    submissions: [
      {
        id: "submission-released",
        assignment_id: "assignment-released",
        student_id: "student-1",
        student_name: "Sam Student",
        student_email: "sam@student.test",
        status: "released",
        submitted_at: "2026-04-20T09:00:00.000Z",
      },
      {
        id: "submission-approved",
        assignment_id: "assignment-approved",
        student_id: "student-2",
        student_name: "Ari Student",
        student_email: "ari@student.test",
        status: "approved",
        submitted_at: "2026-04-21T09:00:00.000Z",
      },
      {
        id: "submission-moderated",
        assignment_id: "assignment-moderated",
        student_id: "student-3",
        student_name: "Jo Student",
        student_email: "jo@student.test",
        status: "moderated",
        submitted_at: "2026-04-22T09:00:00.000Z",
      },
      {
        id: "submission-submitted",
        assignment_id: "assignment-submitted",
        student_id: "student-4",
        student_name: "Rae Student",
        student_email: "rae@student.test",
        status: "submitted",
        submitted_at: "2026-04-23T09:00:00.000Z",
      },
      {
        id: "submission-aigraded",
        assignment_id: "assignment-aigraded",
        student_id: "student-5",
        student_name: "Kai Student",
        student_email: "kai@student.test",
        status: "ai_graded",
        submitted_at: "2026-04-24T09:00:00.000Z",
      },
    ],
    grades: [
      {
        submission_id: "submission-released",
        ai_score: 69,
        lecturer_score: 72,
        final_score: 74,
        ai_feedback: "Released AI feedback",
        lecturer_feedback: "Released lecturer feedback",
        final_feedback: "Released final feedback",
        reviewed_at: "2026-04-25T09:00:00.000Z",
        reviewed_by: lecturer.id,
      },
      {
        submission_id: "submission-approved",
        ai_score: 64,
        lecturer_score: 66,
        final_score: 68,
        ai_feedback: "Approved AI feedback",
        lecturer_feedback: "Approved lecturer feedback",
        final_feedback: "Approved final feedback",
        reviewed_at: "2026-04-25T10:00:00.000Z",
        reviewed_by: lecturer.id,
      },
      {
        submission_id: "submission-moderated",
        ai_score: 58,
        lecturer_score: 61,
        final_score: 63,
        ai_feedback: "Moderated AI feedback",
        lecturer_feedback: "Moderated lecturer feedback",
        final_feedback: "Moderated final feedback",
        reviewed_at: "2026-04-25T11:00:00.000Z",
        reviewed_by: lecturer.id,
      },
      {
        submission_id: "submission-submitted",
        ai_score: null,
        lecturer_score: null,
        final_score: null,
        ai_feedback: "",
        lecturer_feedback: "",
        final_feedback: "",
        reviewed_at: null,
        reviewed_by: null,
      },
      {
        submission_id: "submission-aigraded",
        ai_score: 52,
        lecturer_score: null,
        final_score: null,
        ai_feedback: "Provisional AI feedback",
        lecturer_feedback: "",
        final_feedback: "",
        reviewed_at: null,
        reviewed_by: null,
      },
    ],
    profiles: [
      { id: lecturer.id, full_name: lecturer.fullName, email: lecturer.email, role: "admin", avatar_url: null, cohort_id: null, department_id: null },
      { id: "student-1", full_name: "Sam Student", email: "sam@student.test", role: "student", avatar_url: null, cohort_id: "cohort-1", department_id: "cs" },
      { id: "student-2", full_name: "Ari Student", email: "ari@student.test", role: "student", avatar_url: null, cohort_id: "cohort-1", department_id: "cs" },
      { id: "student-3", full_name: "Jo Student", email: "jo@student.test", role: "student", avatar_url: null, cohort_id: "cohort-1", department_id: "cs" },
      { id: "student-4", full_name: "Rae Student", email: "rae@student.test", role: "student", avatar_url: null, cohort_id: "cohort-1", department_id: "cs" },
      { id: "student-5", full_name: "Kai Student", email: "kai@student.test", role: "student", avatar_url: null, cohort_id: "cohort-1", department_id: "cs" },
    ],
  });

  await installSupabaseMocks(page, state);
  await setE2EAuth(page, { role: "admin", ...lecturer });

  await page.addInitScript(() => {
    let lastDownload: { href: string; download: string } | null = null;
    Object.defineProperty(window, "__gradeAiLastDownload", {
      configurable: true,
      get: () => lastDownload,
      set: (value) => {
        lastDownload = value;
      },
    });

    URL.createObjectURL = () => "blob:gradeai-export";
    URL.revokeObjectURL = () => undefined;

    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click() {
      (window as Window & { __gradeAiLastDownload?: { href: string; download: string } }).__gradeAiLastDownload = {
        href: this.href,
        download: this.download,
      };
      return originalClick.call(this);
    };
  });

  await page.goto("/dashboard/external-examiner");

  await expect(page.getByText("Export Preview")).toBeVisible();
  await expect(page.getByText("3 records ready for export", { exact: true })).toBeVisible();
  await expect(page.getByText("Released Dissertation")).toBeVisible();
  await expect(page.getByText("Approved Capstone")).toBeVisible();
  await expect(page.getByText("Moderated Project")).toBeVisible();

  await expect(page.getByText("Submitted Draft")).not.toBeVisible();
  await expect(page.getByText("AI Graded Draft")).not.toBeVisible();

  await expect(page.getByRole("button", { name: "Export CSV" })).toBeEnabled();
  await page.getByRole("button", { name: "Export CSV" }).click();
  await expect(page.getByText("Export downloaded successfully")).toBeVisible();

  const lastDownload = await page.evaluate(() => {
    return (window as Window & { __gradeAiLastDownload?: { href: string; download: string } }).__gradeAiLastDownload ?? null;
  });

  expect(lastDownload).not.toBeNull();
  expect(lastDownload?.href).toBe("blob:gradeai-export");
  expect(lastDownload?.download).toContain("external_examiner_export_");
});
