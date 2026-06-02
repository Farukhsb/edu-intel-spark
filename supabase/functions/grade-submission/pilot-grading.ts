import { getEnv } from "../_shared/auth.ts";
import type { AssignmentType } from "../_shared/text-analysis.ts";
import type { RubricCriterion } from "./prompting.ts";

function normalizeShortText(value: string | null | undefined, maxLength: number) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!text) return "";
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

export const PILOT_LEAN_GRADING_EVIDENCE_MAX_CHARS = 4_000;
export const PILOT_LEAN_CRITERION_EVIDENCE_MAX_CHARS = 800;

export function isPilotLeanGradingMode() {
  return getEnv("OPENAI_PILOT_LEAN_GRADING_MODE") !== "false";
}

function buildCompactRubricSummary(rubric: RubricCriterion[]) {
  return rubric
    .map((criterion, index) => {
      const description = normalizeShortText(criterion.description ?? "", 180);
      return `${index + 1}. ${criterion.criterion} (${criterion.weight})${description ? ` - ${description}` : ""}`;
    })
    .join("\n");
}

export function buildPilotLeanSystemPrompt({
  assignmentType,
  rubricLength,
  maximumScore,
}: {
  assignmentType: AssignmentType;
  rubricLength: number;
  maximumScore: number;
}) {
  return `You are a fair, rubric-faithful academic marking assistant for higher education.

PILOT LEAN GRADING MODE:
- Apply only the stated rubric and the evidence supplied in the submission packets.
- Score each criterion using only the evidence shown for that criterion.
- Do not invent missing evidence or borrow support from another criterion.
- If evidence is weak or ambiguous, lower confidence and require lecturer review.
- Return concise feedback for lecturer review.
- Return exactly ${rubricLength} criterion rows and valid JSON only.

AssignmentType: ${assignmentType}
Final score is out of ${maximumScore}.`;
}

export function buildPilotLeanGradingPrompt({
  assignmentType,
  assignmentTitle,
  assignmentDescription,
  maximumScore,
  rubric,
  textPreview,
  criterionEvidenceText,
}: {
  assignmentType: AssignmentType;
  assignmentTitle: string;
  assignmentDescription: string | null | undefined;
  maximumScore: number;
  rubric: RubricCriterion[];
  textPreview: string;
  criterionEvidenceText?: string;
}) {
  return `AssignmentType: ${assignmentType}

Assignment title: ${assignmentTitle}
Assignment description: ${normalizeShortText(assignmentDescription ?? "", 320) || "N/A"}
Maximum score: ${maximumScore}

Rubric:
${buildCompactRubricSummary(rubric)}

PILOT LEAN GRADING MODE:
- Apply only the stated rubric.
- Score each criterion using only the evidence shown for that criterion.
- Do not invent missing evidence or borrow support from another criterion.
- If evidence is weak or ambiguous, lower confidence and require lecturer review.
- Return concise feedback for lecturer review.

Submission evidence:
${textPreview}

${criterionEvidenceText ? `Criterion-specific evidence packets:
${criterionEvidenceText}

Use the criterion-specific packets as the primary evidence map. If a packet is weak or limited, lower confidence for that criterion rather than borrowing support from another criterion.` : ""}

Return valid JSON only.`;
}

function buildMathAnalysisSchema() {
  return {
    type: "object",
    properties: {
      symbolic_extraction: { type: "array", items: { type: "string" } },
      derivation_checks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            step_label: { type: "string" },
            status: { type: "string", enum: ["valid", "unclear", "invalid"] },
            rationale: { type: "string" },
          },
          required: ["step_label", "status", "rationale"],
          additionalProperties: false,
        },
      },
      error_classification: {
        type: "string",
        enum: ["arithmetic_slip", "conceptual_flaw", "none"],
      },
      solver_signals: { type: "array", items: { type: "string" } },
    },
    required: ["symbolic_extraction", "derivation_checks", "error_classification", "solver_signals"],
    additionalProperties: false,
  };
}

export function buildPilotLeanResponseSchema(rubricLength: number, includeMathAnalysis: boolean) {
  const schema: Record<string, unknown> = {
    type: "object",
    properties: {
      total_score: { type: "number" },
      overall_feedback: { type: "string" },
      confidence_score: { type: "number" },
      lecturer_review_required: { type: "boolean" },
      criteria: {
        type: "array",
        minItems: rubricLength,
        maxItems: rubricLength,
        items: {
          type: "object",
          properties: {
            criterion_name: { type: "string" },
            awarded_score: { type: "number" },
            max_score: { type: "number" },
            reason_for_score: { type: "string" },
            evidence_from_submission: { type: "array", items: { type: "string" } },
            confidence_score: { type: "number" },
          },
          required: [
            "criterion_name",
            "awarded_score",
            "max_score",
            "reason_for_score",
            "evidence_from_submission",
            "confidence_score",
          ],
          additionalProperties: false,
        },
      },
    },
    required: [
      "total_score",
      "overall_feedback",
      "confidence_score",
      "lecturer_review_required",
      "criteria",
    ],
    additionalProperties: false,
  };

  if (includeMathAnalysis) {
    (schema.properties as Record<string, unknown>).math_analysis = buildMathAnalysisSchema();
    (schema.required as string[]).push("math_analysis");
  }

  return schema;
}
