import { logInfo } from "../_shared/log.ts";
import { classifyAssignmentType } from "../_shared/text-analysis.ts";
import {
  buildBatchReusedGradeResult,
  buildFinalizedGradeResult,
  buildFingerprintClusterReuseResult,
  buildGradingHistory,
  buildSavedGradeReuseResult,
  type CachedGradeResult,
} from "./orchestration.ts";
import {
  applyRegradeStabilityAdjudication,
  evaluateFairnessAndReviewState,
} from "./decision-stage.ts";
import {
  buildGradingPrompt,
  buildPositiveFeedbackReevaluationPrompt,
  buildRegradeAnchorText,
  buildRubricCalibrationGuide,
  buildSystemPrompt,
  buildResponseSchema,
  requestStructuredGrade,
  type RubricCriterion,
} from "./prompting.ts";
import {
  buildPilotLeanGradingPrompt,
  buildPilotLeanResponseSchema,
  buildPilotLeanSystemPrompt,
  isPilotLeanGradingMode,
  PILOT_LEAN_CRITERION_EVIDENCE_MAX_CHARS,
  PILOT_LEAN_GRADING_EVIDENCE_MAX_CHARS,
} from "./pilot-grading.ts";
import {
  blindSubmissionText,
  buildCriterionEvidencePackets,
  buildGradingCandidate,
  buildGradingEvidencePacket,
  buildGradingInputHash,
  clampConfidence,
  computeContentFingerprint,
  detectPositiveFeedbackLowScoreMismatch,
  type ExistingGradeRecordWithMeta,
  type FingerprintGradeCluster,
  GRADING_PROMPT_VERSION,
  hasMeaningfulScoreDrift,
  normalizeBreakdown,
  normalizeHistory,
  normalizeMathAnalysis,
  normalizeOverallScore,
  normalizeStringList,
  type GradingCandidate,
} from "./grading-support.ts";
import {
  applyCriterionBandFloorRecalibration,
  assessSubmissionRelevance,
  deriveUkBand,
  detectEvidenceCoverage,
  isNearGradeBoundary,
  redistributeBreakdownToTotal,
  resolveSingleCriterionFairnessRecalibration,
} from "./fairness-support.ts";
import type {
  AssignmentForGrading,
  FetchSubmissionContentForGrading,
  SubmissionForGrading,
} from "./types.ts";

function readEnv(name: string) {
  if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    return Deno.env.get(name);
  }

  if (typeof process !== "undefined" && process.env) {
    return process.env[name];
  }

  return undefined;
}

function isPilotSinglePassMode() {
  return readEnv("OPENAI_PILOT_SINGLE_PASS_MODE") !== "false";
}

export function isPilotLeanGradingModeEnabled() {
  return isPilotLeanGradingMode();
}

type GradeSingleSubmissionParams = {
  sub: SubmissionForGrading;
  assignment: AssignmentForGrading;
  existingGrade: ExistingGradeRecordWithMeta | null;
  existingGradesByFingerprint: Map<string, FingerprintGradeCluster>;
  generatedResultsByFingerprint: Map<string, CachedGradeResult>;
  normalizedRubric: RubricCriterion[];
  rubricText: string;
  gradingModel: string;
  forceRegenerate: boolean;
  regradeReason: string;
  confidenceThreshold: number;
  gradingPasses: number;
  getPassSpreadThreshold: (maxScore: number) => number;
  fetchSubmissionContent: FetchSubmissionContentForGrading;
};

export async function gradeSingleSubmission({
  sub,
  assignment,
  existingGrade,
  existingGradesByFingerprint,
  generatedResultsByFingerprint,
  normalizedRubric,
  rubricText,
  gradingModel,
  forceRegenerate,
  regradeReason,
  confidenceThreshold,
  gradingPasses,
  getPassSpreadThreshold,
  fetchSubmissionContent,
}: GradeSingleSubmissionParams) {
  const { extractedText, extractionMetadata } = await fetchSubmissionContent(sub);
  const blindedText = blindSubmissionText({
    text: extractedText,
    studentName: sub.student_name,
    studentEmail: sub.student_email,
    fileName: sub.file_name,
  });
  const gradingInputHash = await buildGradingInputHash({
    submissionText: blindedText,
    rubric: normalizedRubric,
    assignmentInstructions: `${assignment.title}\n${assignment.description || ""}`,
    maxScore: assignment.max_score,
  });
  const contentFingerprint = computeContentFingerprint(assignment.id, blindedText);
  const existingMetadata =
    existingGrade?.grading_metadata && typeof existingGrade.grading_metadata === "object"
      ? existingGrade.grading_metadata
      : {};
  const existingHistory = normalizeHistory(existingMetadata);
  const existingHash =
    typeof existingMetadata.grading_input_hash === "string" ? existingMetadata.grading_input_hash : "";
  const existingPromptVersion =
    typeof existingMetadata.grading_prompt_version === "string" ? existingMetadata.grading_prompt_version : "";
  const existingFingerprint =
    typeof existingMetadata.content_fingerprint === "string" ? existingMetadata.content_fingerprint : "";
  const cacheHit =
    !forceRegenerate &&
    existingGrade?.ai_score != null &&
    existingHash === gradingInputHash &&
    existingPromptVersion === GRADING_PROMPT_VERSION;
  if (cacheHit) {
    logInfo("grade-submission cache", {
      cache_hit: true,
      grading_input_hash: gradingInputHash,
      force_regenerate: forceRegenerate,
      ai_called: false,
      existing_score_returned: Number(existingGrade.ai_score),
      submissionId: sub.id,
    });
    const cachedBreakdown = normalizeBreakdown(existingGrade.ai_breakdown, normalizedRubric);
    const cachedConfidence = clampConfidence(
      existingGrade.grading_confidence ?? existingMetadata.confidence_score,
    );
    const cachedAssignmentType = classifyAssignmentType({
      title: assignment.title,
      description: assignment.description,
      rubricText,
      text: blindedText.substring(0, 18000),
    });
    return buildSavedGradeReuseResult({
      submissionId: sub.id,
      existingAiScore: Number(existingGrade.ai_score),
      existingAiFeedback: existingGrade.ai_feedback,
      existingMetadata,
      cachedBreakdown,
      assignmentType: cachedAssignmentType,
      cachedConfidence,
      gradingInputHash,
      promptVersion: GRADING_PROMPT_VERSION,
      contentFingerprint,
      extractionMetadata,
    });
  }
  logInfo("grade-submission cache", {
    cache_hit: false,
    grading_input_hash: gradingInputHash,
    force_regenerate: forceRegenerate,
    ai_called: false,
    existing_score_returned: existingGrade?.ai_score == null ? null : Number(existingGrade.ai_score),
    submissionId: sub.id,
    existing_prompt_version: existingPromptVersion || null,
    existing_hash: existingHash || null,
    existing_fingerprint: existingFingerprint || null,
  });

  const matchingGeneratedResult = generatedResultsByFingerprint.get(gradingInputHash);
  if (matchingGeneratedResult) {
    logInfo("grade-submission cache", {
      cache_hit: true,
      grading_input_hash: gradingInputHash,
      force_regenerate: forceRegenerate,
      ai_called: false,
      existing_score_returned: matchingGeneratedResult.score,
      submissionId: sub.id,
    });
    return buildBatchReusedGradeResult({
      submissionId: sub.id,
      gradingInputHash,
      promptVersion: GRADING_PROMPT_VERSION,
      contentFingerprint,
      extractionMetadata,
      matchingGeneratedResult,
    });
  }

  const matchingExistingFingerprintCluster = existingGradesByFingerprint.get(contentFingerprint) ?? null;
  const matchingExistingFingerprintGrade = matchingExistingFingerprintCluster?.canonicalGrade ?? null;
  const matchingClusterMetadata =
    matchingExistingFingerprintGrade?.grading_metadata &&
      typeof matchingExistingFingerprintGrade.grading_metadata === "object"
      ? matchingExistingFingerprintGrade.grading_metadata
      : {};
  const matchingClusterHash =
    typeof matchingClusterMetadata.grading_input_hash === "string" ? matchingClusterMetadata.grading_input_hash : "";
  const matchingClusterPromptVersion =
    typeof matchingClusterMetadata.grading_prompt_version === "string"
      ? matchingClusterMetadata.grading_prompt_version
      : "";
  if (
    matchingExistingFingerprintGrade?.ai_score != null &&
    matchingClusterHash === gradingInputHash &&
    matchingClusterPromptVersion === GRADING_PROMPT_VERSION
  ) {
    logInfo("grade-submission cache", {
      cache_hit: true,
      grading_input_hash: gradingInputHash,
      force_regenerate: forceRegenerate,
      ai_called: false,
      existing_score_returned: Number(matchingExistingFingerprintGrade.ai_score),
      submissionId: sub.id,
    });
    const reusedBreakdown = normalizeBreakdown(
      matchingExistingFingerprintGrade.ai_breakdown,
      normalizedRubric,
    );
    const reusedConfidence = clampConfidence(
      matchingExistingFingerprintGrade.grading_confidence,
    );
    const clusterMismatch =
      (matchingExistingFingerprintCluster?.gradeCount || 0) > 1 &&
      (matchingExistingFingerprintCluster?.scoreSpread || 0) > 0;
    const reusedAssignmentType = classifyAssignmentType({
      title: assignment.title,
      description: assignment.description,
      rubricText,
      fileName: sub.file_name,
      text: blindedText,
    });
    return buildFingerprintClusterReuseResult({
      submissionId: sub.id,
      existingAiScore: Number(matchingExistingFingerprintGrade.ai_score),
      existingAiFeedback: matchingExistingFingerprintGrade.ai_feedback,
      reusedBreakdown,
      assignmentType: reusedAssignmentType,
      reusedConfidence,
      clusterMismatch,
      reusedFromSubmissionId: matchingExistingFingerprintGrade.submission_id,
      duplicateClusterGradeCount: matchingExistingFingerprintCluster?.gradeCount || 1,
      duplicateClusterScoreSpread: matchingExistingFingerprintCluster?.scoreSpread || 0,
      matchingClusterMetadata,
      gradingInputHash,
      promptVersion: GRADING_PROMPT_VERSION,
      contentFingerprint,
      extractionMetadata,
    });
  }

  const pilotLeanMode = isPilotLeanGradingMode();
  const gradingEvidencePacket = buildGradingEvidencePacket({
    submissionText: blindedText,
    rubric: normalizedRubric,
    assignmentTitle: assignment.title,
    assignmentDescription: assignment.description,
    maxChars: pilotLeanMode ? PILOT_LEAN_GRADING_EVIDENCE_MAX_CHARS : 18_000,
  });
  const criterionEvidencePackets = buildCriterionEvidencePackets({
    submissionText: blindedText,
    rubric: normalizedRubric,
    assignmentTitle: assignment.title,
    assignmentDescription: assignment.description,
    maxCharsPerCriterion: pilotLeanMode ? PILOT_LEAN_CRITERION_EVIDENCE_MAX_CHARS : 2600,
  });
  const criterionEvidenceText = criterionEvidencePackets
    .map((entry, index) =>
      `Criterion ${index + 1}: ${entry.criterion}\n${entry.packet || "No focused evidence packet could be extracted."}`)
    .join("\n\n---\n\n");
  const assignmentType = classifyAssignmentType({
    title: assignment.title,
    description: assignment.description,
    rubricText,
    fileName: sub.file_name,
    text: blindedText,
  });
  const isMathMode = assignmentType === "Mathematics" || assignmentType === "Problem Solving";

  const systemPrompt = pilotLeanMode
    ? buildPilotLeanSystemPrompt({
      assignmentType,
      rubricLength: normalizedRubric.length,
      maximumScore: assignment.max_score,
    })
    : buildSystemPrompt(
      assignmentType,
      normalizedRubric.length,
      assignment.max_score,
    );
  const responseSchema = pilotLeanMode
    ? buildPilotLeanResponseSchema(normalizedRubric.length, isMathMode)
    : buildResponseSchema(normalizedRubric.length, isMathMode);
  const prompt = pilotLeanMode
    ? buildPilotLeanGradingPrompt({
      assignmentType,
      assignmentTitle: assignment.title,
      assignmentDescription: assignment.description,
      maximumScore: assignment.max_score,
      rubric: normalizedRubric,
      textPreview: gradingEvidencePacket,
      criterionEvidenceText,
    })
    : buildGradingPrompt({
      assignmentType,
      assignmentTitle: assignment.title,
      assignmentDescription: assignment.description,
      moduleCode: assignment.module_code,
      maximumScore: assignment.max_score,
      rubricText,
      rubricCalibrationGuide: buildRubricCalibrationGuide(
        normalizedRubric,
        assignment.max_score,
      ),
      regradeAnchorText: buildRegradeAnchorText(existingGrade),
      textPreview: gradingEvidencePacket,
      criterionEvidenceText,
    });

  const requestDiagnostics = {
    pilot_lean_mode: pilotLeanMode,
    system_prompt_char_length: systemPrompt.length,
    user_prompt_char_length: prompt.length,
    response_schema_char_length: JSON.stringify(responseSchema).length,
    rubric_criterion_count: normalizedRubric.length,
    submission_evidence_char_length: gradingEvidencePacket.length,
    criterion_evidence_total_char_length: criterionEvidencePackets.reduce(
      (sum, entry) => sum + entry.packet.length,
      0,
    ),
  };

  const previousAiScore = existingGrade?.ai_score != null ? Number(existingGrade.ai_score) : null;
  const pilotSinglePassMode = isPilotSinglePassMode();
  const effectiveGradingPasses = pilotSinglePassMode ? 1 : gradingPasses;
  const passCandidates: GradingCandidate[] = [];
  for (let passIndex = 0; passIndex < effectiveGradingPasses; passIndex++) {
    logInfo("grade-submission ai-call", {
      cache_hit: false,
      grading_input_hash: gradingInputHash,
      force_regenerate: forceRegenerate,
      ai_called: true,
      existing_score_returned: previousAiScore,
      submissionId: sub.id,
      passIndex,
    });
    let passResult = await requestStructuredGrade({
      gradingModel,
      systemPrompt,
      prompt,
      rubricLength: normalizedRubric.length,
      isMathMode,
      responseSchema,
    });

    if (!passResult) continue;

    let candidate = buildGradingCandidate(passResult, normalizedRubric, assignment.max_score);
    if (!pilotSinglePassMode && candidate.positiveFeedbackLowScoreMismatch) {
      const reevaluationPrompt = buildPositiveFeedbackReevaluationPrompt({
        prompt,
        passResult,
        maximumScore: assignment.max_score,
      });
      const reevaluated = await requestStructuredGrade({
        gradingModel,
        systemPrompt,
        prompt: reevaluationPrompt,
        rubricLength: normalizedRubric.length,
        isMathMode,
        responseSchema,
      });
      if (reevaluated) {
        passResult = reevaluated;
        candidate = buildGradingCandidate(passResult, normalizedRubric, assignment.max_score);
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
      assignment.max_score,
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
  const passSpreadThreshold = getPassSpreadThreshold(assignment.max_score);
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
        assignmentMaxScore: assignment.max_score,
        stabilityNotes,
        prompt,
        existingGrade,
        gradeResult,
        gradingModel,
        systemPrompt,
        normalizedRubric,
        isMathMode,
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
      assignmentMaxScore: assignment.max_score,
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
      applyCriterionBandFloorRecalibration,
      detectEvidenceCoverage,
      deriveUkBand,
      assessSubmissionRelevance,
      resolveSingleCriterionFairnessRecalibration,
      redistributeBreakdownToTotal,
      isNearGradeBoundary,
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
  const requiresLecturerReview = pilotLeanMode ? true : fairnessAndReview.requiresLecturerReview;
  if (pilotLeanMode) {
    reviewReasons.push("Pilot lean mode requires lecturer review for every AI-generated grade before release.");
  }
  const feedbackParts = fairnessAndReview.feedbackParts;

  const gradingHistory = buildGradingHistory({
    existingAiScore: existingGrade?.ai_score == null ? null : Number(existingGrade.ai_score),
    existingGradingConfidence: existingGrade?.grading_confidence ?? null,
    existingHistory,
    forceRegenerate,
    existingHash,
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
    assignmentType,
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
    requestDiagnostics,
  });

  generatedResultsByFingerprint.set(gradingInputHash, finalizedGradeResult);
  logInfo("grade-submission generated", {
    submissionId: sub.id,
    gradingInputHash,
    promptVersion: GRADING_PROMPT_VERSION,
    forceRegenerate,
    recalibrationApplied,
  });

  return {
    submissionId: sub.id,
    ...finalizedGradeResult,
    rubricValidated: true,
    success: true,
  };
}
