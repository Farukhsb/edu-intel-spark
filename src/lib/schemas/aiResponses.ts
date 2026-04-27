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
