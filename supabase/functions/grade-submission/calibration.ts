import type { GradeAIResponse } from "../_shared/grade-ai-response.ts";
import type { RubricCriterion } from "./prompting.ts";
const CONFIDENCE_THRESHOLD = 0.7;
const REGRADING_DRIFT_THRESHOLD_RATIO = 0.08;
const REGRADING_DRIFT_THRESHOLD_MIN = 8;
export const GRADING_PROMPT_VERSION = "2026-05-25-v9";
export type GradeBreakdownItem = {
  criterion: string;
  score: number;
  max_score: number;
  performance_band: string;
  comment: string;
  evidence_snippet: string;
  rubric_expectation: string;
  evidence_from_submission: string;
  reason_for_score: string;
  improvement_feedback: string;
  strengths: string[];
  weaknesses: string[];
  confidence_score: number;
  review_required: boolean;
  error_type?: "arithmetic_slip" | "conceptual_flaw" | "none";
};
export type MathAnalysis = {
  symbolic_extraction: string[];
  derivation_checks: Array<{
    step_label: string;
    status: "valid" | "unclear" | "invalid";
    rationale: string;
  }>;
  error_classification: "arithmetic_slip" | "conceptual_flaw" | "none";
  solver_signals: string[];
};
export type ExistingGradeRecordWithMeta = {
  id: string;
  submission_id: string;
  ai_score: number | null;
  ai_feedback: string | null;
  ai_breakdown: unknown;
  grading_confidence?: number | null;
  grading_metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};
export type FingerprintGradeCluster = {
  fingerprint: string;
  canonicalGrade: ExistingGradeRecordWithMeta;
  gradeCount: number;
  scoreSpread: number;
};
export type NormalizedBreakdown = {
  breakdown: GradeBreakdownItem[];
  total: number;
  averageConfidence: number;
  reviewReasons: string[];
  fairnessNotes: string[];
  recalibrated: boolean;
};
export type GradingCandidate = {
  gradeResult: GradeAIResponse;
  normalized: NormalizedBreakdown;
  modelScore: number | null;
  modelFeedback: string;
  scoreAdjusted: boolean;
  positiveFeedbackLowScoreMismatch: boolean;
};
export function clampScore(value: unknown, maxScore: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(maxScore, Number(numeric.toFixed(2))));
}
export function clampConfidence(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, Number(numeric.toFixed(2))));
}
async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function buildGradingInputHash(params: {
  submissionText: string;
  rubric: RubricCriterion[];
  assignmentInstructions: string;
  maxScore: number;
}) {
  return await sha256Hex(
    [
      params.submissionText,
      JSON.stringify(params.rubric),
      params.assignmentInstructions,
      String(params.maxScore),
      GRADING_PROMPT_VERSION,
    ].join("\n---\n"),
  );
}
export function normalizeHistory(metadata: Record<string, unknown> | null | undefined) {
  if (!Array.isArray(metadata?.grading_history)) return [];
  return metadata.grading_history
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      previous_score: item.previous_score == null ? null : Number(item.previous_score),
      new_score: item.new_score == null ? null : Number(item.new_score),
      previous_confidence: item.previous_confidence == null ? null : Number(item.previous_confidence),
      new_confidence: item.new_confidence == null ? null : Number(item.new_confidence),
      grading_input_hash: typeof item.grading_input_hash === "string" ? item.grading_input_hash : "",
      prompt_version: typeof item.prompt_version === "string" ? item.prompt_version : "",
      timestamp: typeof item.timestamp === "string" ? item.timestamp : "",
      reason_for_regrade: typeof item.reason_for_regrade === "string" ? item.reason_for_regrade : "",
    }))
    .filter((item) => item.grading_input_hash);
}
function normalizeFingerprintText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}
function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function splitNameTokens(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(/[\s._-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}
export function normalizeStringList(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items.slice(0, 6) : fallback;
}
function normalizeEvidence(value: unknown) {
  if (typeof value !== "string") return "No supporting quote extracted.";
  const text = value.trim();
  if (!text) return "No supporting quote extracted.";
  return text.slice(0, 280);
}
function normalizeComment(value: unknown) {
  if (typeof value !== "string") return "No criterion-specific comment provided.";
  const text = value.trim();
  return text || "No criterion-specific comment provided.";
}
function normalizeImprovementFeedback(value: unknown) {
  if (typeof value !== "string") return "No rubric-specific improvement guidance provided.";
  const text = value.trim();
  return text || "No rubric-specific improvement guidance provided.";
}
function normalizePerformanceBand(value: unknown) {
  if (typeof value !== "string") return "Unspecified";
  const text = value.trim();
  return text || "Unspecified";
}
function normalizeErrorType(value: unknown): GradeBreakdownItem["error_type"] {
  return value === "arithmetic_slip" || value === "conceptual_flaw" || value === "none" ? value : "none";
}
function normalizeCriterionKey(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function deriveNegativeEvidenceCap(params: {
  performanceBand: string;
  comment: string;
  evidence: string;
  reason: string;
  maxScore: number;
}) {
  const combined = `${params.performanceBand} ${params.comment} ${params.evidence} ${params.reason}`.toLowerCase();
  if (combined.includes("no evidence")) {
    return Number((params.maxScore * 0.1).toFixed(2));
  }
  const severeNegativeSignals = [
    "no supporting quote extracted",
    "no justification",
    "no discussion of design choices",
    "no discussion of trade-offs",
    "does not identify any functional dependencies",
    "fails to identify any functional dependencies",
    "no functional dependencies identified",
    "does not define any primary or foreign keys",
    "no primary or foreign keys",
    "no keys or integrity constraints defined",
    "no coherent 3nf structure",
    "does not provide a coherent 3nf structure",
    "lacks a coherent 3nf structure",
  ];
  if (severeNegativeSignals.some((signal) => combined.includes(signal))) {
    return Number((params.maxScore * 0.25).toFixed(2));
  }
  return null;
}
export function normalizeBreakdown(raw: unknown, rubric: RubricCriterion[]): NormalizedBreakdown {
  const provided = Array.isArray(raw) ? raw : [];
  const normalizedProvided = provided.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>>;
  const byCriterion = new Map(
    normalizedProvided.map((item) => {
      const breakdown = item as Record<string, unknown>;
      const criterion = normalizeCriterionKey(breakdown.criterion_name ?? breakdown.criterion);
      return [criterion.toLowerCase(), breakdown] as const;
    }),
  );
  const fairnessNotes: string[] = [];
  let recalibrated = false;
  const breakdown: GradeBreakdownItem[] = rubric.map((criterion) => {
    const normalizedCriterion = normalizeCriterionKey(criterion.criterion);
    const matched =
      byCriterion.get(normalizedCriterion) ||
      (rubric.length === 1 && normalizedProvided.length === 1 ? normalizedProvided[0] : undefined);
    const maxScore = criterion.weight;
    const rawScoreValue = matched?.awarded_score ?? matched?.score;
    const rawScore = Number(rawScoreValue);
    let score = clampScore(rawScoreValue, maxScore);
    const rawMaxScore = Number(matched?.max_score);
    const confidence = clampConfidence(matched?.confidence_score);
    const performanceBand = normalizePerformanceBand(matched?.performance_band);
    const comment = normalizeComment(matched?.reason_for_score ?? matched?.comment);
    const evidence = normalizeEvidence(
      Array.isArray(matched?.evidence_from_submission)
        ? normalizeStringList(matched?.evidence_from_submission).join("; ")
        : matched?.evidence_from_submission ?? matched?.evidence_snippet,
    );
    const negativeEvidenceCap = deriveNegativeEvidenceCap({
      performanceBand,
      comment,
      evidence,
      reason: comment,
      maxScore,
    });
    const reviewRequired =
      typeof matched?.review_required === "boolean"
        ? matched.review_required
        : typeof matched?.lecturer_review_required === "boolean"
          ? matched.lecturer_review_required
          : confidence < CONFIDENCE_THRESHOLD;
    if (Number.isFinite(rawScore) && Math.abs(rawScore - score) > 0.01) {
      recalibrated = true;
      fairnessNotes.push(`${criterion.criterion}: awarded_score was recalibrated to fit criterion max_score.`);
    }
    if (Number.isFinite(rawMaxScore) && rawMaxScore === 100 && maxScore !== 100) {
      recalibrated = true;
      fairnessNotes.push(`${criterion.criterion}: AI appeared to score this criterion out of 100 instead of ${maxScore}.`);
    }
    if (negativeEvidenceCap != null && score > negativeEvidenceCap) {
      recalibrated = true;
      fairnessNotes.push(
        `${criterion.criterion}: score was capped because the criterion rationale described missing or absent evidence.`,
      );
      score = negativeEvidenceCap;
    }
    return {
      criterion: criterion.criterion,
      score,
      max_score: maxScore,
      performance_band: performanceBand,
      comment,
      evidence_snippet: evidence,
      rubric_expectation: normalizeComment(matched?.rubric_expectation ?? criterion.description ?? ""),
      evidence_from_submission: evidence,
      reason_for_score: comment,
      improvement_feedback: normalizeImprovementFeedback(matched?.improvement_feedback),
      strengths: normalizeStringList(matched?.strengths),
      weaknesses: normalizeStringList(matched?.weaknesses),
      confidence_score: confidence,
      review_required: reviewRequired,
      error_type: normalizeErrorType(matched?.error_type),
    };
  });
  const total = Number(breakdown.reduce((sum, item) => sum + item.score, 0).toFixed(2));
  const averageConfidence =
    breakdown.length > 0
      ? Number(
          (
            breakdown.reduce((sum, item) => sum + item.confidence_score * item.max_score, 0) /
            Math.max(1, breakdown.reduce((sum, item) => sum + item.max_score, 0))
          ).toFixed(3),
        )
      : 0;
  const reviewReasons = breakdown
    .filter((item) => item.review_required)
    .map((item) => `${item.criterion} confidence ${item.confidence_score}`);
  return { breakdown, total, averageConfidence, reviewReasons, fairnessNotes, recalibrated };
}
export function normalizeMathAnalysis(raw: unknown): MathAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  const derivationChecks = Array.isArray(candidate.derivation_checks)
    ? candidate.derivation_checks
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const entry = item as Record<string, unknown>;
          const status = entry.status === "valid" || entry.status === "unclear" || entry.status === "invalid"
            ? entry.status
            : "unclear";
          return {
            step_label: typeof entry.step_label === "string" ? entry.step_label.trim() || "Step" : "Step",
            status,
            rationale: typeof entry.rationale === "string" ? entry.rationale.trim() : "",
          };
        })
    : [];
  const symbolicExtraction = Array.isArray(candidate.symbolic_extraction)
    ? candidate.symbolic_extraction.filter((item): item is string => typeof item === "string").slice(0, 12)
    : [];
  const solverSignals = Array.isArray(candidate.solver_signals)
    ? candidate.solver_signals.filter((item): item is string => typeof item === "string").slice(0, 8)
    : [];
  return {
    symbolic_extraction: symbolicExtraction,
    derivation_checks: derivationChecks,
    error_classification:
      candidate.error_classification === "arithmetic_slip" ||
      candidate.error_classification === "conceptual_flaw" ||
      candidate.error_classification === "none"
        ? candidate.error_classification
        : "none",
    solver_signals: solverSignals,
  };
}
export function normalizeOverallScore(value: unknown, maxScore: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return clampScore(numeric, maxScore);
}
export function detectPositiveFeedbackLowScoreMismatch(feedback: string, score: number, maxScore: number) {
  const normalizedFeedback = feedback.toLowerCase();
  const ratio = maxScore > 0 ? score / maxScore : 0;
  const positiveSignals = [
    "solid",
    "meets the core requirements",
    "meets core requirements",
    "meets all core requirements",
    "meets requirements",
    "good",
    "clear",
    "relevant",
    "applies required techniques correctly",
    "applies the required techniques correctly",
    "solid report",
    "competent engagement",
    "competent analysis",
    "clear preprocessing",
    "two analytical techniques",
    "logical conclusion",
    "logical interpretation",
    "reasonable interpretation",
    "strongest evidence",
  ];
  return ratio < 0.4 && positiveSignals.some((signal) => normalizedFeedback.includes(signal));
}
export function buildGradingCandidate(
  gradeResult: GradeAIResponse,
  rubric: RubricCriterion[],
  assignmentMaxScore: number,
): GradingCandidate {
  const normalized = normalizeBreakdown(gradeResult.criteria ?? gradeResult.breakdown, rubric);
  const modelScore = normalizeOverallScore(gradeResult.total_score ?? gradeResult.score, assignmentMaxScore);
  const modelFeedback =
    typeof (gradeResult.overall_feedback ?? gradeResult.feedback) === "string" &&
      String(gradeResult.overall_feedback ?? gradeResult.feedback).trim()
      ? String(gradeResult.overall_feedback ?? gradeResult.feedback).trim()
      : "No detailed feedback was returned.";
  const scoreAdjusted = modelScore != null && Math.abs(modelScore - normalized.total) > 1;
  const positiveFeedbackLowScoreMismatch = detectPositiveFeedbackLowScoreMismatch(
    modelFeedback,
    normalized.total,
    assignmentMaxScore,
  );
  return {
    gradeResult,
    normalized,
    modelScore,
    modelFeedback,
    scoreAdjusted,
    positiveFeedbackLowScoreMismatch,
  };
}
export function hasMeaningfulScoreDrift(previousScore: number, nextScore: number, maxScore: number) {
  const threshold = Math.max(REGRADING_DRIFT_THRESHOLD_MIN, Math.round(maxScore * REGRADING_DRIFT_THRESHOLD_RATIO));
  return Math.abs(previousScore - nextScore) >= threshold;
}
