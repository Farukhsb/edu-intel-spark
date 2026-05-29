import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildGradingPrompt,
  buildResponseSchema,
  buildSystemPrompt,
} from "../../supabase/functions/grade-submission/prompting";
import {
  buildPilotLeanGradingPrompt,
  buildPilotLeanResponseSchema,
  buildPilotLeanSystemPrompt,
  isPilotLeanGradingMode,
  PILOT_LEAN_CRITERION_EVIDENCE_MAX_CHARS,
  PILOT_LEAN_GRADING_EVIDENCE_MAX_CHARS,
} from "../../supabase/functions/grade-submission/pilot-grading";
import { gradeSingleSubmission } from "../../supabase/functions/grade-submission/submission-stage";
import { normalizeRubricForAssignment } from "../../supabase/functions/grade-submission/request-stage";
import * as promptingModule from "../../supabase/functions/grade-submission/prompting";
import type {
  AssignmentForGrading,
  SubmissionForGrading,
} from "../../supabase/functions/grade-submission/types";

describe("pilot lean grading request", () => {
  const originalDeno = globalThis.Deno;

  beforeEach(() => {
    globalThis.Deno = {
      env: {
        get: (name: string) => {
          if (name === "OPENAI_PILOT_LEAN_GRADING_MODE") return undefined;
          if (name === "OPENAI_PILOT_SINGLE_PASS_MODE") return undefined;
          return undefined;
        },
      },
    } as typeof Deno;
  });

  afterEach(() => {
    globalThis.Deno = originalDeno;
    vi.restoreAllMocks();
  });

  it("defaults to lean mode unless explicitly disabled", () => {
    expect(isPilotLeanGradingMode()).toBe(true);

    globalThis.Deno = {
      env: {
        get: (name: string) => {
          if (name === "OPENAI_PILOT_LEAN_GRADING_MODE") return "false";
          return undefined;
        },
      },
    } as typeof Deno;

    expect(isPilotLeanGradingMode()).toBe(false);
  });

  it("builds a smaller lean prompt and schema while preserving strict structured output", () => {
    const assignmentType = "Report";
    const rubric = [
      { criterion: "Analysis", weight: 50, description: "Analyse the key trade-offs in detail." },
      { criterion: "Evidence", weight: 50, description: "Support claims with relevant evidence and examples." },
    ];
    const fullPrompt = buildGradingPrompt({
      assignmentType,
      assignmentTitle: "Systems report",
      assignmentDescription: "Evaluate options with evidence and justification.",
      moduleCode: "CS330",
      maximumScore: 100,
      rubricText: "- Analysis (50): Evaluate trade-offs\n- Evidence (50): Support claims",
      rubricCalibrationGuide: "CALIBRATION GUIDE",
      regradeAnchorText: "PRIOR GRADE ANCHOR",
      textPreview: "Full submission evidence",
      criterionEvidenceText: "Criterion 1: Analysis\nExcerpt 1...\n\n---\n\nCriterion 2: Evidence\nExcerpt 2...",
    });
    const leanPrompt = buildPilotLeanGradingPrompt({
      assignmentType,
      assignmentTitle: "Systems report",
      assignmentDescription: "Evaluate options with evidence and justification.",
      maximumScore: 100,
      rubric,
      textPreview: "Full submission evidence",
      criterionEvidenceText: "Criterion 1: Analysis\nExcerpt 1...\n\n---\n\nCriterion 2: Evidence\nExcerpt 2...",
    });
    const fullSystemPrompt = buildSystemPrompt(assignmentType, rubric.length, 100);
    const leanSystemPrompt = buildPilotLeanSystemPrompt({
      assignmentType,
      rubricLength: rubric.length,
      maximumScore: 100,
    });
    const fullSchema = buildResponseSchema(rubric.length, false);
    const leanSchema = buildPilotLeanResponseSchema(rubric.length, false);

    expect(leanPrompt).toContain("PILOT LEAN GRADING MODE");
    expect(leanPrompt).not.toContain("RUBRIC-FIRST CALIBRATION GUIDE");
    expect(leanPrompt).not.toContain("ASSIGNMENT-TYPE STRATEGY");
    expect(leanPrompt).not.toContain("PRIOR GRADE ANCHOR");
    expect(leanPrompt.length).toBeLessThan(fullPrompt.length);

    expect(leanSystemPrompt).toContain("PILOT LEAN GRADING MODE");
    expect(leanSystemPrompt).not.toContain("CALIBRATION");
    expect(leanSystemPrompt.length).toBeLessThan(fullSystemPrompt.length);

    const leanSchemaText = JSON.stringify(leanSchema);
    const fullSchemaText = JSON.stringify(fullSchema);

    expect(leanSchemaText).not.toContain("performance_band");
    expect(leanSchemaText).not.toContain("rubric_expectation");
    expect(leanSchemaText).not.toContain("improvement_actions");
    expect(leanSchemaText).not.toContain("math_analysis");
    expect(leanSchemaText.length).toBeLessThan(fullSchemaText.length);
  });

  it("keeps math analysis only for explicit mathematics-style lean requests", () => {
    const leanMathSchema = buildPilotLeanResponseSchema(2, true);
    const leanNonMathSchema = buildPilotLeanResponseSchema(2, false);

    expect(JSON.stringify(leanMathSchema)).toContain("math_analysis");
    expect(JSON.stringify(leanNonMathSchema)).not.toContain("math_analysis");
  });

  it("records safe request-size metadata and honors the lean evidence caps in a successful grading run", async () => {
    const requestStructuredGradeSpy = vi.spyOn(promptingModule, "requestStructuredGrade");
    requestStructuredGradeSpy.mockResolvedValueOnce({
      total_score: 48,
      overall_feedback: "The work is relevant but underdeveloped.",
      confidence_score: 0.71,
      lecturer_review_required: true,
      criteria: [
        {
          criterion_name: "Analysis",
          awarded_score: 24,
          max_score: 50,
          reason_for_score: "The analysis is present but lacks depth.",
          evidence_from_submission: ["The report compares options and notes trade-offs."],
          confidence_score: 0.71,
        },
        {
          criterion_name: "Evidence",
          awarded_score: 24,
          max_score: 50,
          reason_for_score: "The evidence is relevant but thin.",
          evidence_from_submission: ["The report cites a benchmark result."],
          confidence_score: 0.68,
        },
      ],
    });

    const assignment: AssignmentForGrading = {
      id: "assignment-lean",
      lecturer_id: "lecturer-1",
      title: "Systems Design Report",
      description: "Evaluate the trade-offs in a distributed system design.",
      module_code: "CS330",
      max_score: 100,
      rubric: [
        { criterion: "Analysis", weight: 50, description: "Analyse the key trade-offs in detail." },
        { criterion: "Evidence", weight: 50, description: "Support claims with relevant evidence and examples." },
      ],
    };
    const { normalizedRubric, rubricText } = normalizeRubricForAssignment(assignment);
    const submission: SubmissionForGrading = {
      id: "submission-lean",
      assignment_id: assignment.id,
      student_name: "Student Example",
      student_email: "student@example.com",
      file_name: "systems-report.txt",
      file_url: "submissions/systems-report.txt",
    };
    const extractedText = Array.from({ length: 220 }, (_, index) =>
      `Paragraph ${index + 1}: The report compares replication, partitioning, and consistency trade-offs while supporting the claims with evidence and limited justification.`
    ).join("\n\n");

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
      gradingPasses: 1,
      getPassSpreadThreshold: () => 10,
      fetchSubmissionContent: async () => ({
        extractedText,
        extractionMetadata: {
          extracted_text_length: extractedText.length,
          extraction_success: true,
        },
      }),
    });

    expect(requestStructuredGradeSpy).toHaveBeenCalledTimes(1);
    const requestArgs = requestStructuredGradeSpy.mock.calls[0]?.[0];
    expect(requestArgs.systemPrompt).toContain("PILOT LEAN GRADING MODE");
    expect(requestArgs.systemPrompt).not.toContain("RUBRIC-FIRST CALIBRATION GUIDE");
    expect(requestArgs.prompt).toContain("PILOT LEAN GRADING MODE");
    expect(requestArgs.prompt).not.toContain("ASSIGNMENT-TYPE STRATEGY");
    expect(JSON.stringify(requestArgs.responseSchema)).not.toContain("performance_band");

    expect(result.gradingMetadata.pilot_lean_mode).toBe(true);
    expect(result.gradingMetadata.system_prompt_char_length).toBe(requestArgs.systemPrompt.length);
    expect(result.gradingMetadata.user_prompt_char_length).toBe(requestArgs.prompt.length);
    expect(result.gradingMetadata.response_schema_char_length).toBe(
      JSON.stringify(requestArgs.responseSchema).length,
    );
    expect(result.gradingMetadata.rubric_criterion_count).toBe(2);
    expect(result.gradingMetadata.submission_evidence_char_length).toBeLessThanOrEqual(
      PILOT_LEAN_GRADING_EVIDENCE_MAX_CHARS,
    );
    expect(result.gradingMetadata.criterion_evidence_total_char_length).toBeLessThanOrEqual(
      PILOT_LEAN_CRITERION_EVIDENCE_MAX_CHARS * 2,
    );
    expect(result.gradingMetadata.grading_pass_count).toBe(1);
    expect(JSON.stringify(result.gradingMetadata)).not.toContain(extractedText.slice(0, 48));
  });

  it("forces lecturer review in lean mode even when the model reports high confidence and no review requirement", async () => {
    const requestStructuredGradeSpy = vi.spyOn(promptingModule, "requestStructuredGrade");
    requestStructuredGradeSpy.mockResolvedValueOnce({
      total_score: 92,
      overall_feedback: "The submission is strong and well supported.",
      confidence_score: 0.99,
      lecturer_review_required: false,
      criteria: [
        {
          criterion_name: "Analysis",
          awarded_score: 46,
          max_score: 50,
          reason_for_score: "The analysis is strong and well supported.",
          evidence_from_submission: ["The report compares options and evaluates trade-offs clearly."],
          confidence_score: 0.99,
        },
        {
          criterion_name: "Evidence",
          awarded_score: 46,
          max_score: 50,
          reason_for_score: "The evidence is relevant and well integrated.",
          evidence_from_submission: ["The report cites evidence from the submission."],
          confidence_score: 0.99,
        },
      ],
    });

    const assignment: AssignmentForGrading = {
      id: "assignment-lean-review",
      lecturer_id: "lecturer-1",
      title: "Systems Design Report",
      description: "Evaluate the trade-offs in a distributed system design.",
      module_code: "CS330",
      max_score: 100,
      rubric: [
        { criterion: "Analysis", weight: 50, description: "Analyse the key trade-offs in detail." },
        { criterion: "Evidence", weight: 50, description: "Support claims with relevant evidence and examples." },
      ],
    };
    const { normalizedRubric, rubricText } = normalizeRubricForAssignment(assignment);
    const submission: SubmissionForGrading = {
      id: "submission-lean-review",
      assignment_id: assignment.id,
      student_name: "Student Example",
      student_email: "student@example.com",
      file_name: "systems-report.txt",
      file_url: "submissions/systems-report.txt",
    };
    const extractedText = Array.from({ length: 30 }, (_, index) =>
      `Paragraph ${index + 1}: The report weighs replication, partitioning, and consistency trade-offs while staying on topic.`
    ).join("\n\n");

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
      gradingPasses: 1,
      getPassSpreadThreshold: () => 10,
      fetchSubmissionContent: async () => ({
        extractedText,
        extractionMetadata: {
          extracted_text_length: extractedText.length,
          extraction_success: true,
        },
      }),
    });

    expect(requestStructuredGradeSpy).toHaveBeenCalledTimes(1);
    expect(result.requiresLecturerReview).toBe(true);
    expect(result.gradingMetadata.lecturer_review_required).toBe(true);
    expect(result.reviewReasons).toContain(
      "Pilot lean mode requires lecturer review for every AI-generated grade before release.",
    );
  });

  it("keeps non-lean grading behavior unchanged when the model does not request review", async () => {
    globalThis.Deno = {
      env: {
        get: (name: string) => {
          if (name === "OPENAI_PILOT_LEAN_GRADING_MODE") return "false";
          return undefined;
        },
      },
    } as typeof Deno;

    const requestStructuredGradeSpy = vi.spyOn(promptingModule, "requestStructuredGrade");
    requestStructuredGradeSpy.mockResolvedValueOnce({
      total_score: 76,
      overall_feedback: "The submission addresses the task clearly and does not require extra review.",
      confidence_score: 0.99,
      lecturer_review_required: false,
      criteria: [
        {
          criterion_name: "Analysis",
          awarded_score: 38,
          max_score: 50,
          performance_band: "Good",
          evidence_from_submission: ["The report compares options and evaluates trade-offs clearly."],
          reason_for_score: "The analysis is strong and well supported.",
          strengths: ["Strong analysis"],
          weaknesses: ["Minor omissions"],
          improvement_feedback: "Minor refinements would make the work even stronger.",
          confidence_score: 0.99,
          error_type: "none",
        },
        {
          criterion_name: "Evidence",
          awarded_score: 38,
          max_score: 50,
          performance_band: "Good",
          evidence_from_submission: ["The report cites evidence from the submission."],
          reason_for_score: "The evidence is relevant and well integrated.",
          strengths: ["Relevant evidence"],
          weaknesses: ["Could cite more detail"],
          improvement_feedback: "Add one more precise example to strengthen the evidence base.",
          confidence_score: 0.99,
          error_type: "none",
        },
      ],
    });

    const assignment: AssignmentForGrading = {
      id: "assignment-non-lean",
      lecturer_id: "lecturer-1",
      title: "Systems Design Report",
      description: "Evaluate the trade-offs in a distributed system design.",
      module_code: "CS330",
      max_score: 100,
      rubric: [
        { criterion: "Analysis", weight: 50, description: "Analyse the key trade-offs in detail." },
        { criterion: "Evidence", weight: 50, description: "Support claims with relevant evidence and examples." },
      ],
    };
    const { normalizedRubric, rubricText } = normalizeRubricForAssignment(assignment);
    const submission: SubmissionForGrading = {
      id: "submission-non-lean",
      assignment_id: assignment.id,
      student_name: "Student Example",
      student_email: "student@example.com",
      file_name: "systems-report.txt",
      file_url: "submissions/systems-report.txt",
    };
    const extractedText =
      "This systems design report provides analysis of trade-offs and evidence for the recommendations.";

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
      gradingPasses: 1,
      getPassSpreadThreshold: () => 10,
      fetchSubmissionContent: async () => ({
        extractedText,
        extractionMetadata: {
          extracted_text_length: extractedText.length,
          extraction_success: true,
        },
      }),
    });

    expect(requestStructuredGradeSpy).toHaveBeenCalledTimes(1);
    expect(result.requiresLecturerReview).toBe(false);
    expect(result.gradingMetadata.lecturer_review_required).toBe(false);
    expect(result.gradingMetadata.pilot_lean_mode).toBe(false);
  });
});
