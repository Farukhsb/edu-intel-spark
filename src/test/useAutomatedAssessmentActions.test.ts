import { describe, expect, it, vi } from "vitest";

import { persistGradedSubmissionResult } from "@/pages/dashboard/assignment-detail/workflows/useAutomatedAssessmentActions";
import {
  buildExtractionFailureRecoveryIssue,
} from "@/pages/dashboard/assignment-detail/workflows/automatedAssessmentShared";

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
      name: "GradePersistenceError",
      message: "grade write failed",
      step: "grade_write",
    });
  });

  it("uses truthful PDF extraction recovery wording", () => {
    const issue = buildExtractionFailureRecoveryIssue();

    expect(issue).toMatchObject({
      headline: "Readable file needed",
      recoveryLabel: "Needs re-upload",
      type: "extraction_failure",
    });
    expect(issue.detail).toBe(
      "GradeAI could not reliably extract text from this PDF. Continue with manual review or upload a DOCX copy while PDF support is being verified.",
    );
  });
});
