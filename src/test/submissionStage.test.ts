import { describe, expect, it } from "vitest";
import { gradeSingleSubmission } from "../../supabase/functions/grade-submission/submission-stage";
import {
  buildGradingInputHash,
  GRADING_PROMPT_VERSION,
} from "../../supabase/functions/grade-submission/grading-support";
import { normalizeRubricForAssignment } from "../../supabase/functions/grade-submission/request-stage";
import type {
  AssignmentForGrading,
  SubmissionForGrading,
} from "../../supabase/functions/grade-submission/types";

describe("grade-submission submission stage", () => {
  it("reuses the saved cached grade when the grading hash matches", async () => {
    const assignment: AssignmentForGrading = {
      id: "assignment-1",
      lecturer_id: "lecturer-1",
      title: "Database Normalisation Case Study",
      description: "Redesign the schema and justify trade-offs.",
      module_code: "CS220",
      max_score: 80,
      rubric: [
        { criterion: "Schema Design", weight: 40, description: "Produce a coherent schema." },
        { criterion: "Trade-off Discussion", weight: 40, description: "Explain design compromises." },
      ],
    };
    const { normalizedRubric, rubricText } = normalizeRubricForAssignment(assignment);
    const submission: SubmissionForGrading = {
      id: "submission-1",
      assignment_id: assignment.id,
      student_name: "Faruk Student",
      student_email: "faruk@example.com",
      file_name: "normalisation.txt",
      file_url: "submissions/normalisation.txt",
    };
    const extractedText = "Third normal form removes transitive dependencies and reduces duplication.";
    const gradingInputHash = await buildGradingInputHash({
      submissionText: extractedText,
      rubric: normalizedRubric,
      assignmentInstructions: `${assignment.title}\n${assignment.description || ""}`,
      maxScore: assignment.max_score,
    });

    const result = await gradeSingleSubmission({
      sub: submission,
      assignment,
      existingGrade: {
        id: "grade-1",
        submission_id: submission.id,
        ai_score: 68,
        ai_feedback: "Strong normalization analysis.",
        ai_breakdown: [
          {
            criterion: "Schema Design",
            score: 34,
            max_score: 40,
            performance_band: "Good",
            comment: "Clear structure.",
            evidence_snippet: "Third normal form...",
            rubric_expectation: "Produce a coherent schema.",
            evidence_from_submission: "Third normal form...",
            reason_for_score: "Covers key normalisation decisions.",
            improvement_feedback: "Expand on candidate keys.",
            strengths: ["Normal form reasoning"],
            weaknesses: ["Key discussion"],
            confidence_score: 0.82,
            review_required: false,
          },
        ],
        grading_confidence: 0.82,
        grading_metadata: {
          grading_input_hash: gradingInputHash,
          grading_prompt_version: GRADING_PROMPT_VERSION,
          lecturer_review_required: false,
        },
        created_at: "2026-05-08T10:00:00.000Z",
      },
      existingGradesByFingerprint: new Map(),
      generatedResultsByFingerprint: new Map(),
      normalizedRubric,
      rubricText,
      gradingModel: "gpt-test-model",
      forceRegenerate: false,
      regradeReason: "No change.",
      confidenceThreshold: 0.7,
      gradingPasses: 1,
      getPassSpreadThreshold: () => 8,
      fetchSubmissionContent: async () => ({
        extractedText,
        extractionMetadata: {
          extracted_text_length: extractedText.length,
          extraction_success: true,
        },
      }),
    });

    expect(result.success).toBe(true);
    expect(result.score).toBe(68);
    expect(result.feedback).toContain("Strong normalization analysis.");
    expect(result.gradingMetadata.cached_result).toBe(true);
    expect(result.gradingMetadata.grading_input_hash).toBe(gradingInputHash);
    expect(result.cacheMessage).toContain("Using saved AI marking result");
  });
});
