import { getEnv } from "../_shared/env.ts";
import { applyCriterionBandFloorRecalibration, assessSubmissionRelevance, detectEvidenceCoverage, deriveUkBand, isNearGradeBoundary, redistributeBreakdownToTotal, resolveSingleCriterionFairnessRecalibration } from "./fairness-support.ts";
import { buildFinalizedGradeResult, buildGradingHistory } from "./orchestration.ts";
import {
  type ExistingGradeRecordWithMeta,
  type FingerprintGradeCluster,
  type GradingCandidate,
  buildGradingCandidate,
  clampConfidence,
  detectPositiveFeedbackLowScoreMismatch,
  hasMeaningfulScoreDrift,
  normalizeBreakdown,
  normalizeHistory,
  normalizeMathAnalysis,
  normalizeOverallScore,
  normalizeStringList,
  GRADING_PROMPT_VERSION,
} from "./calibration.ts";
import {
  applyRegradeStabilityAdjudication,
  evaluateFairnessAndReviewState,
} from "./decision-stage.ts";
import { buildPositiveFeedbackReevaluationPrompt, requestStructuredGrade, type RubricCriterion } from "./prompting.ts";
import type { AssignmentForGrading } from "./types.ts";

export function isPilotSinglePassMode() {
  return getEnv("OPENAI_PILOT_SINGLE_PASS_MODE") !== "false";
}

type GradingPromptBundle = {
  pilotLeanMode: boolean;
  submissionSafetyNotice: string;
  promptInjectionRisk: { hasRisk: boolean; signals: string[] };
  assignmentType: string;
  isMathMode: boolean;
  systemPrompt: string;
  responseSchema: Record<string, unknown>;
  prompt: string;
  requestDiagnostics: Record<string, unknown>;
};

export type RunGradingPassesParams = {
  assignment: AssignmentForGrading;
  existingGrade: ExistingGradeRecordWithMeta | null;
  gradingModel: string;
  forceRegenerate: boolean;
  regradeReason: string;
  confidenceThreshold: number;
  gradingPasses: number;
  getPassSpreadThreshold: (maxScore: number) => number;
  assignmentMaxScore: number;
  normalizedRubric: RubricCriterion[];
  promptBundle: GradingPromptBundle;
  blindedText: string;
  extractionMetadata: Record<string, unknown>;
  previousAiScore: number | null;
  existingHistory: ReturnType<typeof normalizeHistory>;
  existingGradesByFingerprint: Map<string, FingerprintGradeCluster>;
  generatedResultsByFingerprint: Map<string, {
    score: number;
    feedback: string;
    breakdown: Array<Record<string, unknown>>;
    assignmentType: string;
    gradingConfidence: number;
    requiresLecturerReview: boolean;
    reviewReasons: string[];
    gradingMetadata: Record<string, unknown>;
  }>;
  gradingInputHash: string;
  contentFingerprint: string;
};

export async function runGradingPasses(params: RunGradingPassesParams) {
  const {
    assignment,
    existingGrade,
    gradingModel,
    forceRegenerate,
    regradeReason,
    confidenceThreshold,
    gradingPasses,
    getPassSpreadThreshold,
    assignmentMaxScore,
    normalizedRubric,
    promptBundle,
    blindedText,
    extractionMetadata,
    previousAiScore,
    existingHistory,
    existingGradesByFingerprint,
    generatedResultsByFingerprint,
    gradingInputHash,
    contentFingerprint,
  } = params;

  const pilotSinglePassMode = isPilotSinglePassMode();
  const effectiveGradingPasses = pilotSinglePassMode ? 1 : gradingPasses;
  const passCandidates: GradingCandidate[] = [];
  for (let passIndex = 0; passIndex < effectiveGradingPasses; passIndex++) {
    const passResult = await requestStructuredGrade({
      gradingModel,
      systemPrompt: promptBundle.systemPrompt,
      prompt: promptBundle.prompt,
      rubricLength: normalizedRubric.length,
      isMathMode: promptBundle.isMathMode,
      responseSchema: promptBundle.responseSchema,
    });

    if (!passResult) continue;

    let candidate = buildGradingCandidate(passResult, normalizedRubric, assignmentMaxScore);
    if (!pilotSinglePassMode && candidate.positiveFeedbackLowScoreMismatch) {
      const reevaluationPrompt = buildPositiveFeedbackReevaluationPrompt({
        prompt: promptBundle.prompt,
        passResult,
        maximumScore: assignmentMaxScore,
      });
      const reevaluated = await requestStructuredGrade({
        gradingModel,
        systemPrompt: promptBundle.systemPrompt,
        prompt: reevaluationPrompt,
        rubricLength: normalizedRubric.length,
        isMathMode: promptBundle.isMathMode,
        responseSchema: promptBundle.responseSchema,
      });
      if (reevaluated) {
        candidate = buildGradingCandidate(reevaluated, normalizedRubric, assignmentMaxScore);
      }
    }

    passCandidates.push(candidate);
  }

  if (passCandidates.length === 0) throw new Error("Failed to parse AI response");

  const sortedPassCandidates = [...passCandidates].sort((a, b) => a.normalized.total - b.normalized.total);
  const selectedCandidate = sortedPassCandidates[Math.floor(sortedPassCandidates.length / 2)];
  const originalAiScoreBeforeValidation =
    selectedCandidate.modelScore ??
    normalizeOverallScore(
      selectedCandidate.gradeResult.total_score ?? selectedCandidate.gradeResult.score,
      assignmentMaxScore,
    );
  let gradeResult = selectedCandidate.gradeResult;
  let normalized = selectedCandidate.normalized;
  let modelScore = selectedCandidate.modelScore;
  let modelFeedback = selectedCandidate.modelFeedback;
  let gradingConfidence = clampConfidence(
    gradeResult.confidence_score ?? gradeResult.grading_confidence ?? normalized.averageConfidence,
  );
  let scoreAdjusted = selectedCandidate.scoreAdjusted;
  let positiveFeedbackLowScoreMismatch = selectedCandidate.positiveFeedbackLowScoreMismatch;
  const stabilityNotes: string[] = [];

  const passScores = sortedPassCandidates.map((candidate) => candidate.normalized.total);
  const passSpread =
    passScores.length > 0 ? Math.max(...passScores) - Math.min(...passScores) : 0;
  const passSpreadThreshold = getPassSpreadThreshold(assignmentMaxScore);
  if (passScores.length > 1) {
    stabilityNotes.push(
      `Consensus grading applied across ${passScores.length} passes. Pass scores: ${passScores.join(", ")}. Median score selected: ${normalized.total}.`,
    );
  }
  if (!pilotSinglePassMode && passSpread >= passSpreadThreshold) {
    stabilityNotes.push(
      `Pass spread ${passSpread} exceeded the review threshold of ${passSpreadThreshold}, so lecturer review was required.`,
    );
  }
  const regradeStability = pilotSinglePassMode
    ? {
        gradeResult,
        normalized,
        modelScore,
        modelFeedback,
        scoreAdjusted,
        positiveFeedbackLowScoreMismatch,
        regradeVariancePreservedPrior: false,
        stabilityNotes,
      }
    : await applyRegradeStabilityAdjudication(
        {
          previousAiScore,
          normalized,
          assignmentMaxScore,
          stabilityNotes,
          prompt: promptBundle.prompt,
          existingGrade,
          gradeResult,
          gradingModel,
          systemPrompt: promptBundle.systemPrompt,
          normalizedRubric,
          isMathMode: promptBundle.isMathMode,
          modelFeedback,
        },
      {
        normalizeBreakdown,
        normalizeOverallScore,
        detectPositiveFeedbackLowScoreMismatch,
        hasMeaningfulScoreDrift,
          requestStructuredGrade,
        },
      );
  gradeResult = regradeStability.gradeResult;
  normalized = regradeStability.normalized;
  modelScore = regradeStability.modelScore;
  modelFeedback = regradeStability.modelFeedback;
  scoreAdjusted = regradeStability.scoreAdjusted;
  positiveFeedbackLowScoreMismatch = regradeStability.positiveFeedbackLowScoreMismatch;
  const regradeVariancePreservedPrior = regradeStability.regradeVariancePreservedPrior;

  gradingConfidence = clampConfidence(
    gradeResult.confidence_score ?? gradeResult.grading_confidence ?? normalized.averageConfidence,
  );
  if (regradeVariancePreservedPrior) {
    gradingConfidence = Math.min(clampConfidence(existingGrade?.grading_confidence), 0.65);
    gradingConfidence = Math.min(gradingConfidence, 0.65);
  }
  if (passSpread >= passSpreadThreshold) {
    gradingConfidence = Math.min(gradingConfidence, 0.65);
  }
  const fairnessAndReview = evaluateFairnessAndReviewState(
    {
      gradeResult,
      normalized,
      modelFeedback,
      blindedText,
      assignmentTitle: assignment.title,
      assignmentInstructions: assignment.description ?? "",
      assignmentMaxScore,
      normalizedRubric,
      positiveFeedbackLowScoreMismatch,
      extractionMetadata,
      initialGradingConfidence: gradingConfidence,
      scoreAdjusted,
      passSpread,
      passSpreadThreshold,
      passScores,
      regradeVariancePreservedPrior,
      stabilityNotes,
      confidenceThreshold,
    },
    {
      normalizeMathAnalysis,
      applyCriterionBandFloorRecalibration: (await import("./fairness-support.ts")).applyCriterionBandFloorRecalibration,
      detectEvidenceCoverage: (await import("./fairness-support.ts")).detectEvidenceCoverage,
      deriveUkBand: (await import("./fairness-support.ts")).deriveUkBand,
      assessSubmissionRelevance: (await import("./fairness-support.ts")).assessSubmissionRelevance,
      resolveSingleCriterionFairnessRecalibration: (await import("./fairness-support.ts")).resolveSingleCriterionFairnessRecalibration,
      redistributeBreakdownToTotal: (await import("./fairness-support.ts")).redistributeBreakdownToTotal,
      isNearGradeBoundary: (await import("./fairness-support.ts")).isNearGradeBoundary,
    },
  );
    normalized = fairnessAndReview.normalized;
    gradingConfidence = fairnessAndReview.gradingConfidence;
  const mathAnalysis = fairnessAndReview.mathAnalysis;
  const fairnessNotes = fairnessAndReview.fairnessNotes;
  const evidenceCoverage = fairnessAndReview.evidenceCoverage;
  const ukBand = fairnessAndReview.ukBand;
  const relevanceAssessment = fairnessAndReview.relevanceAssessment;
  const recalibrationApplied = fairnessAndReview.recalibrationApplied;
  const reviewReasons = [...fairnessAndReview.reviewReasons];
  const requiresLecturerReview = pilotSinglePassMode
    ? true
    : fairnessAndReview.requiresLecturerReview || promptBundle.promptInjectionRisk.hasRisk;
  if (pilotSinglePassMode) {
    reviewReasons.push("Pilot lean mode requires lecturer review for every AI-generated grade before release.");
  }
  if (promptBundle.promptInjectionRisk.hasRisk) {
    reviewReasons.push("Submission text contained prompt-injection signals; lecturer review required.");
  }
  const feedbackParts = fairnessAndReview.feedbackParts;

  const gradingHistory = buildGradingHistory({
    existingAiScore: existingGrade?.ai_score == null ? null : Number(existingGrade.ai_score),
    existingGradingConfidence: existingGrade?.grading_confidence ?? null,
    existingHistory,
    forceRegenerate,
    existingHash: existingGrade?.grading_metadata && typeof existingGrade.grading_metadata === "object"
      ? (existingGrade.grading_metadata as Record<string, unknown>).grading_input_hash as string | undefined ?? ""
      : "",
    gradingInputHash,
    promptVersion: GRADING_PROMPT_VERSION,
    regradeReason,
    newScore: normalized.total,
    newConfidence: gradingConfidence,
    clampConfidence,
  });

  const finalizedGradeResult = buildFinalizedGradeResult({
    score: normalized.total,
    feedbackParts,
    breakdown: normalized.breakdown,
    assignmentType: promptBundle.assignmentType,
    gradingConfidence,
    requiresLecturerReview,
    reviewReasons,
    gradingInputHash,
    promptVersion: GRADING_PROMPT_VERSION,
    confidenceThreshold,
    forceRegenerate,
    mathAnalysis,
    fairnessNotes,
    stabilityNotes,
    originalAiScoreBeforeValidation,
    ukBand,
    relevanceClassification: relevanceAssessment.classification,
    relevanceReasons: relevanceAssessment.reasons,
    evidenceCoverage,
    previousAiScore,
    recalibrationApplied,
    gradingHistory,
    contentFingerprint,
    passScores,
    passSpread,
    passSpreadThreshold,
    mainStrengths: normalizeStringList(gradeResult.main_strengths),
    mainWeaknesses: normalizeStringList(gradeResult.main_weaknesses),
    extractionMetadata,
    requestDiagnostics: promptBundle.requestDiagnostics,
  });

  generatedResultsByFingerprint.set(gradingInputHash, finalizedGradeResult);

  return {
    ...finalizedGradeResult,
    rubricValidated: true,
    success: true,
    selectedCandidate,
  };
}
