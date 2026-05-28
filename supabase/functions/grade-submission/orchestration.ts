import type { AssignmentType } from "../_shared/text-analysis.ts";

export type CachedGradeResult = {
  score: number;
  feedback: string;
  breakdown: Array<Record<string, unknown>>;
  assignmentType: AssignmentType;
  gradingConfidence: number;
  requiresLecturerReview: boolean;
  reviewReasons: string[];
  gradingMetadata: Record<string, unknown>;
};

export type GradingHistoryEntry = {
  previous_score: number | null;
  new_score: number | null;
  previous_confidence: number | null;
  new_confidence: number | null;
  grading_input_hash: string;
  prompt_version: string;
  timestamp: string;
  reason_for_regrade: string;
};

type FinalizedGradeResultParams = {
  score: number;
  feedbackParts: string[];
  breakdown: Array<Record<string, unknown>>;
  assignmentType: AssignmentType;
  gradingConfidence: number;
  requiresLecturerReview: boolean;
  reviewReasons: string[];
  gradingInputHash: string;
  promptVersion: string;
  confidenceThreshold: number;
  forceRegenerate: boolean;
  mathAnalysis: Record<string, unknown> | null;
  fairnessNotes: string[];
  stabilityNotes: string[];
  originalAiScoreBeforeValidation: number;
  ukBand: string;
  relevanceClassification: string;
  relevanceReasons: string[];
  evidenceCoverage: Record<string, unknown> | null;
  previousAiScore: number | null;
  recalibrationApplied: boolean;
  gradingHistory: GradingHistoryEntry[];
  contentFingerprint: string;
  passScores: number[];
  passSpread: number;
  passSpreadThreshold: number;
  mainStrengths: string[];
  mainWeaknesses: string[];
  extractionMetadata: Record<string, unknown>;
  requestDiagnostics?: Record<string, unknown>;
};

type GradingHistoryParams = {
  existingAiScore: number | null;
  existingGradingConfidence: number | null;
  existingHistory: GradingHistoryEntry[];
  forceRegenerate: boolean;
  existingHash: string | null;
  gradingInputHash: string;
  promptVersion: string;
  regradeReason: string;
  newScore: number;
  newConfidence: number;
  clampConfidence: (value: unknown) => number;
};

type BatchReuseResultParams = {
  submissionId: string;
  gradingInputHash: string;
  promptVersion: string;
  contentFingerprint: string;
  extractionMetadata: Record<string, unknown>;
  matchingGeneratedResult: CachedGradeResult;
};

type SavedGradeReuseResultParams = {
  submissionId: string;
  existingAiScore: number;
  existingAiFeedback: string | null;
  existingMetadata: Record<string, unknown>;
  cachedBreakdown: {
    breakdown: Array<Record<string, unknown>>;
    reviewReasons: string[];
  };
  assignmentType: AssignmentType;
  cachedConfidence: number;
  gradingInputHash: string;
  promptVersion: string;
  contentFingerprint: string;
  extractionMetadata: Record<string, unknown>;
};

type FingerprintClusterReuseResultParams = {
  submissionId: string;
  existingAiScore: number;
  existingAiFeedback: string | null;
  reusedBreakdown: {
    breakdown: Array<Record<string, unknown>>;
    reviewReasons: string[];
  };
  assignmentType: AssignmentType;
  reusedConfidence: number;
  clusterMismatch: boolean;
  reusedFromSubmissionId: string;
  duplicateClusterGradeCount: number;
  duplicateClusterScoreSpread: number;
  matchingClusterMetadata: Record<string, unknown>;
  gradingInputHash: string;
  promptVersion: string;
  contentFingerprint: string;
  extractionMetadata: Record<string, unknown>;
};

export function buildFinalizedGradeResult({
  score,
  feedbackParts,
  breakdown,
  assignmentType,
  gradingConfidence,
  requiresLecturerReview,
  reviewReasons,
  gradingInputHash,
  promptVersion,
  confidenceThreshold,
  forceRegenerate,
  mathAnalysis,
  fairnessNotes,
  stabilityNotes,
  originalAiScoreBeforeValidation,
  ukBand,
  relevanceClassification,
  relevanceReasons,
  evidenceCoverage,
  previousAiScore,
  recalibrationApplied,
  gradingHistory,
  contentFingerprint,
  passScores,
  passSpread,
  passSpreadThreshold,
  mainStrengths,
  mainWeaknesses,
  extractionMetadata,
  requestDiagnostics,
}: FinalizedGradeResultParams): CachedGradeResult {
  return {
    score,
    feedback: feedbackParts.join("\n\n"),
    breakdown,
    assignmentType,
    gradingConfidence,
    requiresLecturerReview,
    reviewReasons: Array.from(new Set(reviewReasons)),
    gradingMetadata: {
      rubric_validated: true,
      confidence_threshold: confidenceThreshold,
      grading_prompt_version: promptVersion,
      grading_input_hash: gradingInputHash,
      cached_result: false,
      force_regenerate: forceRegenerate,
      math_analysis: mathAnalysis,
      fairness_notes: Array.from(new Set(fairnessNotes)),
      stability_notes: Array.from(new Set(stabilityNotes)),
      original_ai_score: originalAiScoreBeforeValidation,
      final_validated_score: score,
      uk_band: ukBand,
      relevance_classification: relevanceClassification,
      relevance_reasons: relevanceReasons,
      evidence_coverage: evidenceCoverage,
      previous_ai_score: previousAiScore,
      recalibration_applied: recalibrationApplied,
      lecturer_review_required: requiresLecturerReview,
      grading_history: gradingHistory,
      content_fingerprint: contentFingerprint,
      blind_grading_applied: true,
      grading_pass_count: passScores.length,
      grading_pass_scores: passScores,
      grading_pass_spread: passSpread,
      grading_pass_spread_threshold: passSpreadThreshold,
      main_strengths: mainStrengths,
      main_weaknesses: mainWeaknesses,
      extraction: extractionMetadata,
      ...(requestDiagnostics ?? {}),
    },
  };
}

export function buildGradingHistory({
  existingAiScore,
  existingGradingConfidence,
  existingHistory,
  forceRegenerate,
  existingHash,
  gradingInputHash,
  promptVersion,
  regradeReason,
  newScore,
  newConfidence,
  clampConfidence,
}: GradingHistoryParams) {
  if (
    existingAiScore == null &&
    !forceRegenerate &&
    existingHash === gradingInputHash
  ) {
    return existingHistory;
  }

  return [
    ...existingHistory,
    {
      previous_score: existingAiScore == null ? null : Number(existingAiScore),
      new_score: newScore,
      previous_confidence:
        existingGradingConfidence == null ? null : clampConfidence(existingGradingConfidence),
      new_confidence: newConfidence,
      grading_input_hash: gradingInputHash,
      prompt_version: promptVersion,
      timestamp: new Date().toISOString(),
      reason_for_regrade: forceRegenerate
        ? regradeReason
        : existingHash && existingHash !== gradingInputHash
          ? regradeReason
          : "Initial grade generation.",
    } satisfies GradingHistoryEntry,
  ];
}

export function buildBatchReusedGradeResult({
  submissionId,
  gradingInputHash,
  promptVersion,
  contentFingerprint,
  extractionMetadata,
  matchingGeneratedResult,
}: BatchReuseResultParams) {
  return {
    submissionId,
    score: matchingGeneratedResult.score,
    feedback: `${matchingGeneratedResult.feedback}\n\nIdentical extracted content detected within this grading batch. Reused the same AI grade for consistency.`,
    breakdown: matchingGeneratedResult.breakdown,
    assignmentType: matchingGeneratedResult.assignmentType,
    gradingConfidence: matchingGeneratedResult.gradingConfidence,
    requiresLecturerReview: matchingGeneratedResult.requiresLecturerReview,
    reviewReasons: Array.from(
      new Set([
        ...matchingGeneratedResult.reviewReasons,
        "Identical extracted content detected within this grading batch; reused prior batch result.",
      ]),
    ),
    gradingMetadata: {
      ...matchingGeneratedResult.gradingMetadata,
      grading_input_hash: gradingInputHash,
      grading_prompt_version: promptVersion,
      cached_result: true,
      final_validated_score: matchingGeneratedResult.score,
      content_fingerprint: contentFingerprint,
      blind_grading_applied: true,
      reused_identical_content_grade: true,
      extraction: extractionMetadata,
    },
    rubricValidated: true,
    success: true,
  };
}

export function buildSavedGradeReuseResult({
  submissionId,
  existingAiScore,
  existingAiFeedback,
  existingMetadata,
  cachedBreakdown,
  assignmentType,
  cachedConfidence,
  gradingInputHash,
  promptVersion,
  contentFingerprint,
  extractionMetadata,
}: SavedGradeReuseResultParams) {
  return {
    submissionId,
    score: Number(existingAiScore),
    feedback: existingAiFeedback || "Using saved AI marking result.",
    breakdown: cachedBreakdown.breakdown,
    assignmentType,
    gradingConfidence: cachedConfidence,
    requiresLecturerReview:
      Boolean(existingMetadata.lecturer_review_required) ||
      cachedBreakdown.breakdown.some((item) => Boolean(item.review_required)),
    reviewReasons: Array.from(
      new Set([
        ...cachedBreakdown.reviewReasons,
        "Cached final validated AI result returned because grading input hash matched.",
      ]),
    ),
    gradingMetadata: {
      ...existingMetadata,
      grading_input_hash: gradingInputHash,
      grading_prompt_version: promptVersion,
      cached_result: true,
      final_validated_score: Number(existingAiScore),
      cache_message: "Using saved AI marking result. Re-grade only if submission or rubric changes.",
      content_fingerprint: contentFingerprint,
      extraction: extractionMetadata,
    } as Record<string, unknown>,
    cacheMessage: "Using saved AI marking result. Re-grade only if submission or rubric changes.",
    rubricValidated: true,
    success: true,
  };
}

export function buildFingerprintClusterReuseResult({
  submissionId,
  existingAiScore,
  existingAiFeedback,
  reusedBreakdown,
  assignmentType,
  reusedConfidence,
  clusterMismatch,
  reusedFromSubmissionId,
  duplicateClusterGradeCount,
  duplicateClusterScoreSpread,
  matchingClusterMetadata,
  gradingInputHash,
  promptVersion,
  contentFingerprint,
  extractionMetadata,
}: FingerprintClusterReuseResultParams) {
  return {
    submissionId,
    score: Number(existingAiScore),
    feedback: `${existingAiFeedback || "Reused existing AI grade for identical content."}\n\nIdentical blinded content matched a previously graded submission in this assignment. Reused the canonical cluster grade for consistency.${clusterMismatch ? ` Historical duplicate grades for this same content varied by ${duplicateClusterScoreSpread} marks, so the canonical cluster grade was applied and lecturer review is recommended.` : ""}`,
    breakdown: reusedBreakdown.breakdown,
    assignmentType,
    gradingConfidence: clusterMismatch ? Math.min(reusedConfidence, 0.65) : reusedConfidence,
    requiresLecturerReview: clusterMismatch || reusedBreakdown.breakdown.some((item) => Boolean(item.review_required)),
    reviewReasons: Array.from(
      new Set([
        ...reusedBreakdown.reviewReasons,
        "Identical blinded content matched a previously graded submission in this assignment.",
        ...(clusterMismatch
          ? [
            `Historical duplicate grades for this same content varied by ${duplicateClusterScoreSpread} marks; canonical cluster grade applied.`,
          ]
          : []),
      ]),
    ),
    gradingMetadata: {
      ...matchingClusterMetadata,
      grading_input_hash: gradingInputHash,
      grading_prompt_version: promptVersion,
      cached_result: true,
      final_validated_score: Number(existingAiScore),
      content_fingerprint: contentFingerprint,
      blind_grading_applied: true,
      reused_identical_content_grade: true,
      reused_from_submission_id: reusedFromSubmissionId,
      duplicate_cluster_grade_count: duplicateClusterGradeCount,
      duplicate_cluster_score_spread: duplicateClusterScoreSpread,
      extraction: extractionMetadata,
    },
    rubricValidated: true,
    success: true,
  };
}
