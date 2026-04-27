import { z } from "zod";

const BreakdownSourceSchema = z
  .object({
    criterion: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    score: z.number().finite(),
    max_score: z.number().finite().optional(),
    maxScore: z.number().finite().optional(),
    feedback: z.string().optional(),
    comment: z.string().optional(),
  })
  .refine((value) => Boolean(value.criterion || value.name), {
    message: "Breakdown item requires a criterion or name",
  })
  .refine((value) => typeof value.max_score === "number" || typeof value.maxScore === "number", {
    message: "Breakdown item requires max_score or maxScore",
  });

export const GradeBreakdownItemSchema = BreakdownSourceSchema.transform((value) => ({
  criterion: value.criterion ?? value.name ?? "",
  name: value.name ?? value.criterion ?? "",
  score: value.score,
  max_score: value.max_score ?? value.maxScore ?? 0,
  maxScore: value.maxScore ?? value.max_score ?? 0,
  feedback: value.feedback ?? value.comment,
  comment: value.comment ?? value.feedback,
}));

export const GradeBreakdownArraySchema = z.array(GradeBreakdownItemSchema);
export type GradeBreakdownItem = z.infer<typeof GradeBreakdownItemSchema>;

const AIGradeResponseSourceSchema = z
  .object({
    ai_score: z.number().finite().optional(),
    final_score: z.number().finite().optional(),
    ai_feedback: z.string(),
    grading_confidence: z.number().min(0).max(1).optional(),
    ai_breakdown: GradeBreakdownArraySchema,
  })
  .refine((value) => typeof value.ai_score === "number" || typeof value.final_score === "number", {
    message: "AI response requires ai_score or final_score",
  });

export const AIGradeResponseSchema = AIGradeResponseSourceSchema.transform((value) => ({
  ai_score: value.ai_score ?? value.final_score ?? 0,
  final_score: value.final_score ?? value.ai_score ?? 0,
  ai_feedback: value.ai_feedback,
  grading_confidence: value.grading_confidence,
  ai_breakdown: value.ai_breakdown,
}));
export type AIGradeResponse = z.infer<typeof AIGradeResponseSchema>;

const EdgeAIGradeResponseSourceSchema = z.object({
  score: z.number().finite().nullable().optional(),
  final_score: z.number().finite().optional(),
  ai_score: z.number().finite().optional(),
  feedback: z.string().nullable().optional(),
  ai_feedback: z.string().optional(),
  gradingConfidence: z.number().min(0).max(1).nullable().optional(),
  grading_confidence: z.number().min(0).max(1).optional(),
  breakdown: z.array(z.unknown()).nullable().optional(),
  ai_breakdown: z.array(z.unknown()).optional(),
});

export const safeParseGradeBreakdown = (value: unknown) => GradeBreakdownArraySchema.safeParse(value);

export const safeParseAIGradeResponse = (value: unknown) => AIGradeResponseSchema.safeParse(value);

export const safeParseEdgeAIGradeResponse = (value: unknown) => {
  const raw = EdgeAIGradeResponseSourceSchema.safeParse(value);
  if (!raw.success) return raw;

  return AIGradeResponseSchema.safeParse({
    ai_score: raw.data.ai_score ?? raw.data.score ?? undefined,
    final_score: raw.data.final_score,
    ai_feedback: raw.data.ai_feedback ?? raw.data.feedback ?? "",
    grading_confidence: raw.data.grading_confidence ?? raw.data.gradingConfidence ?? undefined,
    ai_breakdown: raw.data.ai_breakdown ?? raw.data.breakdown ?? [],
  });
};

export const ExplanationResponseSchema = z.object({
  explanation: z.string().min(1).optional(),
  answer: z.string().min(1).optional(),
  guidance: z.string().optional(),
  next_steps: z.array(z.string()).optional(),
  criteria: z
    .array(
      z.object({
        name: z.string(),
        feedback: z.string().optional(),
      }),
    )
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type ExplanationResponse = z.infer<typeof ExplanationResponseSchema>;

export function safeParseExplanationResponse(input: unknown) {
  const result = ExplanationResponseSchema.safeParse(input);

  if (!result.success) {
    return { success: false as const, data: null };
  }

  return { success: true as const, data: result.data };
}

export const SimilarityMatchSchema = z.object({
  source: z.string().optional(),
  percentage: z.number().min(0).max(100).optional(),
  type: z.enum(["internal", "external", "internet"]).optional(),
});

export const IntegrityCheckResponseSchema = z.object({
  similarity_score: z.number().min(0).max(100),
  cited_overlap: z.number().min(0).max(100).optional(),
  uncited_overlap: z.number().min(0).max(100).optional(),
  internal_overlap: z.number().min(0).max(100).optional(),
  external_overlap: z.number().min(0).max(100).optional(),
  risk_level: z.enum(["low", "medium", "high"]).optional(),
  matches: z.array(SimilarityMatchSchema).optional(),
  analysis_limited: z.boolean().optional(),
});

export type IntegrityCheckResponse = z.infer<typeof IntegrityCheckResponseSchema>;

export function safeParseIntegrityResponse(input: unknown) {
  const result = IntegrityCheckResponseSchema.safeParse(input);

  if (!result.success) {
    return { success: false as const, data: null };
  }

  return { success: true as const, data: result.data };
}

const IntegrityFlagSchema = z.object({
  submission_a_id: z.string().optional(),
  submission_b_id: z.string().optional(),
  student_a: z.string(),
  student_b: z.string(),
  similarity_score: z.number().min(0).max(100),
  ai_suspicion_score: z.number().min(0).max(100).optional(),
  baseline_deviation_score: z.number().min(0).max(100).optional(),
  total_risk_score: z.number().min(0).max(100).optional(),
  reason: z.string(),
  evidence_summary: z.string().optional(),
  matched_excerpt: z.string().optional(),
  overlap_analysis: z
    .object({
      total_overlap: z.number().min(0).max(100),
      cited_overlap: z.number().min(0).max(100),
      uncited_overlap: z.number().min(0).max(100),
      internal_peer_overlap: z.number().min(0).max(100),
      external_source_overlap: z.number().min(0).max(100),
    })
    .optional(),
  recommended_action: z.enum(["clear", "review", "investigate"]).optional(),
  integrity_type: z.enum(["similarity", "ai-writing", "baseline-deviation", "mixed"]).optional(),
  severity: z.string(),
});
export type IntegrityBatchFlag = z.infer<typeof IntegrityFlagSchema>;

export const IntegrityBatchResponseSchema = z.object({
  flags: z.array(IntegrityFlagSchema),
  summary: z.string(),
  warnings: z.array(z.string()).optional(),
});

export function safeParseIntegrityBatchResponse(input: unknown) {
  const result = IntegrityBatchResponseSchema.safeParse(input);

  if (!result.success) {
    return { success: false as const, data: null };
  }

  return { success: true as const, data: result.data };
}
