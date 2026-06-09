import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requestStructuredGradeMock } = vi.hoisted(() => ({
  requestStructuredGradeMock: vi.fn(),
}));

vi.mock("../../supabase/functions/grade-submission/prompting", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../supabase/functions/grade-submission/prompting")>();

  return {
    ...actual,
    buildSystemPrompt: () => "system-prompt",
    buildRubricCalibrationGuide: () => "rubric-calibration-guide",
    buildGradingPrompt: () => "grading-prompt",
    buildRegradeAnchorText: () => "",
    requestStructuredGrade: requestStructuredGradeMock,
  };
});

import { gradeSingleSubmission } from "../../supabase/functions/grade-submission/submission-stage";
import { normalizeRubricForAssignment } from "../../supabase/functions/grade-submission/request-stage";
import type {
  AssignmentForGrading,
  SubmissionForGrading,
} from "../../supabase/functions/grade-submission/types";

const originalDeno = globalThis.Deno;

describe("grade-submission consensus grading", () => {
  beforeEach(() => {
    requestStructuredGradeMock.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.Deno = {
      env: {
        get: (name: string) => {
          if (name === "OPENAI_PILOT_LEAN_GRADING_MODE") return "false";
          return undefined;
        },
      },
    } as typeof Deno;
  });

  afterEach(() => {
    globalThis.Deno = originalDeno;
    vi.restoreAllMocks();
  });

  it("defaults to a single grading pass in pilot mode and skips reevaluation", async () => {
    requestStructuredGradeMock.mockResolvedValueOnce({
      assignment_type: "Report",
      total_score: 20,
      overall_feedback: "This is a clear and relevant submission with solid structure, but the depth is limited.",
      main_strengths: ["Clear and relevant"],
      main_weaknesses: ["Limited depth"],
      confidence_score: 0.28,
      lecturer_review_required: true,
      criteria: [
        {
          criterion_name: "Analysis",
          awarded_score: 10,
          max_score: 50,
          performance_band: "Basic",
          evidence_from_submission: ["The submission is clear and relevant."],
          reason_for_score: "The work is present but thin.",
          strengths: ["Relevant"],
          weaknesses: ["Limited depth"],
          improvement_feedback: "Add more analytical depth.",
          confidence_score: 0.28,
          error_type: "none",
        },
        {
          criterion_name: "Evidence",
          awarded_score: 10,
          max_score: 50,
          performance_band: "Basic",
          evidence_from_submission: ["The submission is clear and relevant."],
          reason_for_score: "Support is present but minimal.",
          strengths: ["Relevant"],
          weaknesses: ["Limited support"],
          improvement_feedback: "Use more concrete evidence.",
          confidence_score: 0.28,
          error_type: "none",
        },
      ],
    });

    const assignment: AssignmentForGrading = {
      id: "assignment-1",
      lecturer_id: "lecturer-1",
      title: "Systems Design Report",
      description: "Evaluate the trade-offs in a distributed system design.",
      module_code: "CS330",
      max_score: 100,
      rubric: [
        { criterion: "Analysis", weight: 50, description: "Analyse the key trade-offs." },
        { criterion: "Evidence", weight: 50, description: "Support claims with relevant evidence." },
      ],
    };
    const { normalizedRubric, rubricText } = normalizeRubricForAssignment(assignment);

    const submission: SubmissionForGrading = {
      id: "submission-1",
      assignment_id: assignment.id,
      student_name: "Student Example",
      student_email: "student@example.com",
      file_name: "systems-report.txt",
      file_url: "submissions/systems-report.txt",
    };

    const extractedText =
      "The report compares replication, partitioning, and consistency strategies with direct discussion of latency, fault tolerance, and operational cost. " +
      "It cites benchmark evidence and explains where stronger trade-offs still need justification.";

    const result = await gradeSingleSubmission({
      sub: submission,
      assignment,
      existingGrade: null,
      existingGradesByFingerprint: new Map(),
      generatedResultsByFingerprint: new Map(),
      normalizedRubric,
      rubricText,
      gradingModel: "gpt-test-model",
      forceRegenerate: false,
      regradeReason: "Initial grade generation.",
      confidenceThreshold: 0.7,
      gradingPasses: 3,
      getPassSpreadThreshold: () => 10,
      fetchSubmissionContent: async () => ({
        extractedText,
        extractionMetadata: {
          extracted_text_length: extractedText.length,
          extraction_success: true,
        },
      }),
    });

    expect(requestStructuredGradeMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.gradingMetadata.grading_pass_count).toBe(1);
    expect(result.gradingMetadata.grading_pass_scores).toEqual([20]);
    expect(result.gradingMetadata.lecturer_review_required).toBe(true);
  });

  it("uses the median score across multiple passes and requires lecturer review when spread is high", async () => {
    globalThis.Deno = {
      env: {
        get: (name: string) => {
          if (name === "OPENAI_PILOT_LEAN_GRADING_MODE") return "false";
          if (name === "OPENAI_PILOT_SINGLE_PASS_MODE") return "false";
          if (name === "OPENAI_GRADING_PASSES") return "3";
          return undefined;
        },
      },
    } as typeof Deno;

    const assignment: AssignmentForGrading = {
      id: "assignment-1",
      lecturer_id: "lecturer-1",
      title: "Systems Design Report",
      description: "Evaluate the trade-offs in a distributed system design.",
      module_code: "CS330",
      max_score: 100,
      rubric: [
        { criterion: "Analysis", weight: 50, description: "Analyse the key trade-offs." },
        { criterion: "Evidence", weight: 50, description: "Support claims with relevant evidence." },
      ],
    };
    const { normalizedRubric, rubricText } = normalizeRubricForAssignment(assignment);

    const submission: SubmissionForGrading = {
      id: "submission-1",
      assignment_id: assignment.id,
      student_name: "Student Example",
      student_email: "student@example.com",
      file_name: "systems-report.txt",
      file_url: "submissions/systems-report.txt",
    };

    const extractedText =
      "The report compares replication, partitioning, and consistency strategies with direct discussion of latency, fault tolerance, and operational cost. " +
      "It cites benchmark evidence and explains where stronger trade-offs still need justification.";

    requestStructuredGradeMock
      .mockResolvedValueOnce({
        assignment_type: "Report",
        total_score: 52,
        overall_feedback: "The report addresses the task but evidence is limited.",
        main_strengths: ["Relevant discussion"],
        main_weaknesses: ["Evidence depth"],
        confidence_score: 0.86,
        lecturer_review_required: false,
        criteria: [
          {
            criterion_name: "Analysis",
            awarded_score: 28,
            max_score: 50,
            performance_band: "Satisfactory",
            evidence_from_submission: ["The report compares replication and partitioning trade-offs."],
            reason_for_score: "Analysis is present but not fully developed.",
            strengths: ["Relevant analysis"],
            weaknesses: ["Could go deeper"],
            improvement_feedback: "Expand the comparison with more precise trade-off evaluation.",
            confidence_score: 0.86,
            error_type: "none",
          },
          {
            criterion_name: "Evidence",
            awarded_score: 24,
            max_score: 50,
            performance_band: "Basic",
            evidence_from_submission: ["It cites benchmark evidence."],
            reason_for_score: "Evidence is present but thin.",
            strengths: ["Some evidence"],
            weaknesses: ["Not enough support"],
            improvement_feedback: "Use more concrete benchmark evidence to justify conclusions.",
            confidence_score: 0.84,
            error_type: "none",
          },
        ],
      })
      .mockResolvedValueOnce({
        assignment_type: "Report",
        total_score: 60,
        overall_feedback: "The report provides a competent comparison with reasonable support.",
        main_strengths: ["Competent trade-off discussion"],
        main_weaknesses: ["Could sharpen the recommendation"],
        confidence_score: 0.87,
        lecturer_review_required: false,
        criteria: [
          {
            criterion_name: "Analysis",
            awarded_score: 31,
            max_score: 50,
            performance_band: "Satisfactory",
            evidence_from_submission: ["The report compares replication, partitioning, and consistency strategies."],
            reason_for_score: "Analysis is competent and mostly relevant.",
            strengths: ["Clear comparison"],
            weaknesses: ["Recommendation could be stronger"],
            improvement_feedback: "Tighten the final recommendation using clearer justification.",
            confidence_score: 0.88,
            error_type: "none",
          },
          {
            criterion_name: "Evidence",
            awarded_score: 29,
            max_score: 50,
            performance_band: "Satisfactory",
            evidence_from_submission: ["It cites benchmark evidence and explains latency and fault tolerance trade-offs."],
            reason_for_score: "Evidence supports the main claims with some gaps.",
            strengths: ["Relevant evidence"],
            weaknesses: ["Needs more precision"],
            improvement_feedback: "Add more exact benchmark detail where claims are strongest.",
            confidence_score: 0.86,
            error_type: "none",
          },
        ],
      })
      .mockResolvedValueOnce({
        assignment_type: "Report",
        total_score: 68,
        overall_feedback: "The report is strong and well-supported overall.",
        main_strengths: ["Well-supported discussion"],
        main_weaknesses: ["Minor precision issues"],
        confidence_score: 0.86,
        lecturer_review_required: false,
        criteria: [
          {
            criterion_name: "Analysis",
            awarded_score: 35,
            max_score: 50,
            performance_band: "Good",
            evidence_from_submission: ["The report compares replication, partitioning, and consistency strategies with discussion of operational cost."],
            reason_for_score: "Analysis is strong and mostly well-balanced.",
            strengths: ["Strong analysis"],
            weaknesses: ["Minor omissions"],
            improvement_feedback: "Clarify one or two remaining trade-off choices in more detail.",
            confidence_score: 0.87,
            error_type: "none",
          },
          {
            criterion_name: "Evidence",
            awarded_score: 33,
            max_score: 50,
            performance_band: "Good",
            evidence_from_submission: ["It cites benchmark evidence and explains latency, fault tolerance, and cost trade-offs."],
            reason_for_score: "Evidence is good and mostly convincing.",
            strengths: ["Good evidence use"],
            weaknesses: ["Can still be more exact"],
            improvement_feedback: "Add one more precise benchmark comparison to strengthen the conclusion.",
            confidence_score: 0.85,
            error_type: "none",
          },
        ],
      });

    const result = await gradeSingleSubmission({
      sub: submission,
      assignment,
      existingGrade: null,
      existingGradesByFingerprint: new Map(),
      generatedResultsByFingerprint: new Map(),
      normalizedRubric,
      rubricText,
      gradingModel: "gpt-test-model",
      forceRegenerate: false,
      regradeReason: "Initial grade generation.",
      confidenceThreshold: 0.7,
      gradingPasses: 3,
      getPassSpreadThreshold: () => 10,
      fetchSubmissionContent: async () => ({
        extractedText,
        extractionMetadata: {
          extracted_text_length: extractedText.length,
          extraction_success: true,
        },
      }),
    });

    expect(requestStructuredGradeMock).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(true);
    expect(result.score).toBe(60);
    expect(result.gradingConfidence).toBeLessThanOrEqual(0.65);
    expect(result.requiresLecturerReview).toBe(true);
    expect(result.reviewReasons).toContain(
      "Consensus grading spread was 16 across 3 passes, exceeding the review threshold of 10.",
    );
    expect(result.gradingMetadata.stability_notes).toContain(
      "Consensus grading applied across 3 passes. Pass scores: 52, 60, 68. Median score selected: 60.",
    );
    expect(result.feedback).toContain("Lecturer review recommended");
    expect(result.gradingMetadata.grading_pass_count).toBe(3);
    expect(result.gradingMetadata.grading_pass_scores).toEqual([52, 60, 68]);
    expect(result.gradingMetadata.grading_pass_spread).toBe(16);
  });
});
