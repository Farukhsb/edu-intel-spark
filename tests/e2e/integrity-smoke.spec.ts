import { expect, test } from "@playwright/test";
import { setE2EAuth } from "./helpers/auth";
import { createMockSupabaseState, installSupabaseMocks } from "./helpers/mockSupabase";

const lecturer = {
  id: "lecturer-1",
  email: "lecturer@gradeai.test",
  fullName: "Dr. Ada Lecturer",
};

const student = {
  id: "student-1",
  email: "student@gradeai.test",
  fullName: "Sam Student",
};

test("lecturer can review an integrity case and save a decision", async ({ page }) => {
  const state = createMockSupabaseState({
    assignments: [
      {
        id: "assignment-integrity",
        title: "Research Essay",
        lecturer_id: lecturer.id,
      },
    ],
    submissions: [
      {
        id: "submission-integrity",
        assignment_id: "assignment-integrity",
        student_name: student.fullName,
        student_email: student.email,
        status: "submitted",
        submitted_at: "2026-04-20T10:00:00.000Z",
      },
    ],
    academic_integrity_reviews: [
      {
        id: "review-integrity",
        submission_id: "submission-integrity",
        lecturer_id: lecturer.id,
        review_type: "similarity-plagiarism-suspicion",
        decision: "pending",
        lecturer_note: JSON.stringify({
          latestNote: "",
          history: [],
          integritySnapshot: {
            totalScore: 72,
            aiWritingScore: 10,
            similarityScore: 58,
            baselineDeviationScore: 0,
            riskLevel: "medium",
            analysisLimited: false,
            limitations: [],
            overlapBreakdown: {
              totalOverlap: 58,
              citedOverlap: 8,
              uncitedOverlap: 50,
              internalPeerOverlap: 30,
              externalSourceOverlap: 28,
            },
            evidence: {
              aiWriting: [],
              similarity: [{ label: "Similarity", value: "Matched body section", score: 58 }],
              uncitedMatches: [{ label: "Uncited", value: "Copied paragraph", score: 50 }],
              citedMatches: [],
              peerMatches: [],
              externalMatches: [],
              baselineDeviation: [],
            },
            flags: ["uncited_overlap"],
          },
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

  await expect(page.getByText("Academic Integrity Review Queue")).toBeVisible();
  await expect(page.getByText(student.fullName)).toBeVisible();

  await page.getByRole("button", { name: /review evidence/i }).click();
  await expect(page.getByText("Citation-aware overlap")).toBeVisible();

  await page
    .getByPlaceholder("Explain why the case was cleared, escalated, or held for investigation.")
    .fill("Requires a closer lecturer review.");
  await page.getByRole("button", { name: /save decision/i }).click();

  await expect(page.getByText("Integrity review saved.")).toBeVisible();
  await expect(page.getByText("Requires a closer lecturer review.")).toBeVisible();

  expect(state.tables.academic_integrity_reviews[0].decision).toBe("pending");
  expect(state.tables.academic_integrity_reviews[0].lecturer_note).toContain("Requires a closer lecturer review.");
});
