import { z } from "npm:zod";

const GradeCriterionResultSchema = z
  .object({
    criterion: z.string().optional(),
    criterion_name: z.string().optional(),
    name: z.string().optional(),
    awarded_score: z.number().optional(),
    score: z.number().optional(),
    max_score: z.number().optional(),
    performance_band: z.string().optional(),
    comment: z.string().optional(),
    evidence_snippet: z.string().optional(),
    rubric_expectation: z.string().optional(),
    evidence_from_submission: z.union([z.string(), z.array(z.string())]).optional(),
    reason_for_score: z.string().optional(),
    improvement_feedback: z.string().optional(),
    strengths: z.array(z.string()).optional(),
    weaknesses: z.array(z.string()).optional(),
    confidence_score: z.number().optional(),
    review_required: z.boolean().optional(),
    lecturer_review_required: z.boolean().optional(),
    error_type: z.enum(["arithmetic_slip", "conceptual_flaw", "none"]).optional(),
  })
  .passthrough();

const MathAnalysisSchema = z
  .object({
    symbolic_extraction: z.array(z.string()).optional(),
    derivation_checks: z
      .array(
        z.object({
          step_label: z.string().optional(),
          status: z.enum(["valid", "unclear", "invalid"]).optional(),
          rationale: z.string().optional(),
        }).passthrough(),
      )
      .optional(),
    error_classification: z.enum(["arithmetic_slip", "conceptual_flaw", "none"]).optional(),
    solver_signals: z.array(z.string()).optional(),
  })
  .passthrough();

const GradeAIResponseBaseSchema = z
  .object({
    assignment_type: z.string().optional(),
    total_score: z.number().optional(),
    score: z.number().optional(),
    overall_feedback: z.string().optional(),
    feedback: z.string().optional(),
    main_strengths: z.array(z.string()).optional(),
    main_weaknesses: z.array(z.string()).optional(),
    confidence_score: z.number().optional(),
    grading_confidence: z.number().optional(),
    lecturer_review_required: z.boolean().optional(),
    requires_lecturer_review: z.boolean().optional(),
    review_reasons: z.array(z.string()).optional(),
    math_analysis: MathAnalysisSchema.optional(),
    criteria: z.array(GradeCriterionResultSchema).optional(),
    breakdown: z.array(GradeCriterionResultSchema).optional(),
  })
  .passthrough();

export const GradeAIResponseSchema = GradeAIResponseBaseSchema
  .refine(
    (value) =>
      typeof value.total_score === "number" ||
      typeof value.score === "number" ||
      Array.isArray(value.criteria) ||
      Array.isArray(value.breakdown),
    {
      message: "AI grade response must include a score or criterion breakdown",
    },
  );

export type GradeAIResponse = z.infer<typeof GradeAIResponseSchema>;

export const safeParseGradeAIResponse = (value: unknown) => GradeAIResponseSchema.safeParse(value);
