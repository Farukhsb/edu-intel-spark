import { describe, expect, it, vi } from "vitest";

import {
  GradePersistenceError,
  persistGradedSubmissionResult,
} from "@/pages/dashboard/assignment-detail/workflows/useAutomatedAssessmentActions";

describe("persistGradedSubmissionResult", () => {
  it("writes the grade row", async () => {
    const upsert = vi.fn(async () => ({ error: null }));

    await persistGradedSubmissionResult({
      gradingResult: {
        submissionId: "submission-1",
        success: true,
        score: 72,
        feedback: "Solid reasoning.",
        breakdown: [],
        requiresLecturerReview: false,
      },
      submissionId: "submission-1",
      supabaseClient: {
        from: (table) => {
          if (table === "grades") {
            return { upsert };
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      },
      validatedGrade: {
        ai_score: 72,
        ai_feedback: "Solid reasoning.",
        ai_breakdown: [],
        grading_confidence: 0.84,
      },
    });

    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("throws when the grade row cannot be saved", async () => {
    const upsert = vi.fn(async () => ({ error: { message: "grade write failed" } }));

    await expect(
      persistGradedSubmissionResult({
        gradingResult: {
          submissionId: "submission-1",
          success: true,
        },
        submissionId: "submission-1",
        supabaseClient: {
          from: (table) => {
            if (table === "grades") {
              return { upsert };
            }
            throw new Error(`Unexpected table: ${table}`);
          },
        },
        validatedGrade: {
          ai_score: 72,
          ai_feedback: "Solid reasoning.",
          ai_breakdown: [],
          grading_confidence: 0.84,
        },
      }),
    ).rejects.toMatchObject({
      message: "grade write failed",
      name: "GradePersistenceError",
      step: "grade_write",
    } satisfies Partial<GradePersistenceError>);
  });
});
