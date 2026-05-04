import type { Tables } from "@/integrations/supabase/types";
import { parseStoredReviewPayload } from "@/lib/integrityReviews";
import { z } from "zod";

export const MODERATION_CONFIDENCE_THRESHOLD = 0.7;
export const MODERATION_INTEGRITY_THRESHOLD = 55;

export type ModerationStatus =
  | "first_review"
  | "moderation_pending"
  | "moderation_in_progress"
  | "moderated"
  | "escalated";

export type ModerationAction = "agree" | "adjust" | "return" | "escalate" | "approve";

export interface ModerationSignal {
  code: "low_confidence" | "integrity_risk" | "score_variance" | "boundary_score" | "maths_concern";
  label: string;
  detail: string;
}

type GradeRow = Pick<
  Tables<"grades">,
  "ai_score" | "lecturer_score" | "lecturer_feedback" | "grading_confidence" | "grading_metadata" | "ai_breakdown" | "ai_feedback"
>;

type IntegrityReviewRow = Pick<Tables<"academic_integrity_reviews">, "decision" | "lecturer_note" | "updated_at"> | null;

const boundaryThresholds = [0.4, 0.5, 0.6, 0.7];

const ModerationDerivationCheckSchema = z
  .object({
    status: z.string().optional(),
  })
  .passthrough();

const ModerationMathAnalysisSchema = z.object({
  solver_signals: z.array(z.string()).optional(),
  derivation_checks: z.array(ModerationDerivationCheckSchema).optional(),
});

const ModerationGradingMetadataSchema = z.object({
  math_analysis: ModerationMathAnalysisSchema.optional(),
});

const numeric = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

export const formatSubmissionStatus = (status: string) =>
  status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

export const getBoundaryLabel = (ratio: number) => {
  if (ratio >= 0.7) return "distinction boundary";
  if (ratio >= 0.6) return "merit boundary";
  if (ratio >= 0.5) return "pass boundary";
  return "fail boundary";
};

export const getLatestModeratorReview = (reviews: Tables<"moderation_reviews">[]) =>
  reviews
    .filter((review) => review.reviewer_role === "moderator")
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0] ?? null;

export const evaluateModerationSignals = ({
  grade,
  integrityReview,
  maxScore,
}: {
  grade: GradeRow | null | undefined;
  integrityReview?: IntegrityReviewRow;
  maxScore: number;
}) => {
  const signals: ModerationSignal[] = [];
  const aiScore = numeric(grade?.ai_score);
  const lecturerScore = numeric(grade?.lecturer_score);
  const confidence = numeric(grade?.grading_confidence);
  const scoreWindow = Math.max(2, Math.round(maxScore * 0.02));
  const varianceThreshold = Math.max(10, Math.round(maxScore * 0.1));

  if (confidence != null && confidence < MODERATION_CONFIDENCE_THRESHOLD) {
    signals.push({
      code: "low_confidence",
      label: "Low confidence",
      detail: `AI grading confidence is ${Math.round(confidence * 100)}%, below the moderation threshold.`,
    });
  }

  if (aiScore != null && lecturerScore != null && Math.abs(aiScore - lecturerScore) >= varianceThreshold) {
    signals.push({
      code: "score_variance",
      label: "Large marker variance",
      detail: `AI and first marker scores differ by ${Math.abs(aiScore - lecturerScore)} points.`,
    });
  }

  const effectiveScore = lecturerScore ?? aiScore;
  if (effectiveScore != null) {
    const matchedBoundary = boundaryThresholds.find((threshold) => {
      const boundaryScore = maxScore * threshold;
      return Math.abs(effectiveScore - boundaryScore) <= scoreWindow;
    });

    if (matchedBoundary != null) {
      signals.push({
        code: "boundary_score",
        label: "Boundary classification",
        detail: `Score ${effectiveScore}/${maxScore} sits near the ${getBoundaryLabel(matchedBoundary)}.`,
      });
    }
  }

  const parsedGradingMetadata = ModerationGradingMetadataSchema.safeParse(grade?.grading_metadata);
  const mathAnalysis = parsedGradingMetadata.success ? parsedGradingMetadata.data.math_analysis : undefined;
  const solverSignals = mathAnalysis?.solver_signals ?? [];
  const invalidDerivations =
    mathAnalysis?.derivation_checks?.filter((item) => item.status === "invalid") ?? [];

  if (solverSignals.length > 0 || invalidDerivations.length > 0) {
    signals.push({
      code: "maths_concern",
      label: "Maths derivation concern",
      detail:
        solverSignals[0] ||
        `${invalidDerivations.length} derivation step(s) were marked invalid in maths review metadata.`,
    });
  }

  let integrityRiskScore = 0;
  if (integrityReview) {
    const payload = parseStoredReviewPayload(integrityReview);
    integrityRiskScore = payload.integritySnapshot?.totalScore || 0;
    if (
      integrityRiskScore >= MODERATION_INTEGRITY_THRESHOLD ||
      integrityReview.decision === "investigate" ||
      integrityReview.decision === "misconduct-concern"
    ) {
      signals.push({
        code: "integrity_risk",
        label: "Integrity risk",
        detail:
          integrityRiskScore >= MODERATION_INTEGRITY_THRESHOLD
            ? `Integrity risk score is ${integrityRiskScore}%.`
            : `Integrity decision is ${integrityReview.decision.replace(/-/g, " ")}.`,
      });
    }
  }

  return {
    needsModeration: signals.length > 0,
    signals,
    triggerFlags: signals.map((signal) => signal.code),
    triggerSummary: signals.map((signal) => signal.detail).join(" "),
    confidenceScore: confidence,
    integrityRiskScore,
  };
};
