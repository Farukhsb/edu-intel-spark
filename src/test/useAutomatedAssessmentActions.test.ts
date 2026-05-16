import { describe, expect, it, vi } from "vitest";

import { persistGradedSubmissionResult } from "@/pages/dashboard/assignment-detail/workflows/useAutomatedAssessmentActions";

describe("persistGradedSubmissionResult", () => {
  it("writes the grade row and advances the submission workflow status", async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));

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

          return { update };
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
    expect(eq).toHaveBeenCalledWith("id", "submission-1");
  });

  it("throws when the grade row cannot be saved", async () => {
    const upsert = vi.fn(async () => ({ error: { message: "grade write failed" } }));
    const update = vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    }));

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

            return { update };
          },
        },
        validatedGrade: {
          ai_score: 72,
          ai_feedback: "Solid reasoning.",
          ai_breakdown: [],
          grading_confidence: 0.84,
        },
      }),
    ).rejects.toThrow("grade write failed");
  });

  it("throws when the submission workflow status cannot be updated", async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const eq = vi.fn(async () => ({ error: { message: "status write failed" } }));
    const update = vi.fn(() => ({ eq }));

    await expect(
      persistGradedSubmissionResult({
        gradingResult: {
          submissionId: "submission-1",
          success: true,
          requiresLecturerReview: true,
        },
        submissionId: "submission-1",
        supabaseClient: {
          from: (table) => {
            if (table === "grades") {
              return { upsert };
            }

            return { update };
          },
        },
        validatedGrade: {
          ai_score: 72,
          ai_feedback: "Solid reasoning.",
          ai_breakdown: [],
          grading_confidence: 0.84,
        },
      }),
    ).rejects.toThrow("status write failed");
  });
});
