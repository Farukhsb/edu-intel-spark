import type { GradeAIResponse } from "../_shared/grade-ai-response.ts";
import type {
  EvidenceCoverage,
  RelevanceAssessment,
} from "./fairness-support.ts";
import type {
  GradeBreakdownItem,
  MathAnalysis,
  NormalizedBreakdown,
} from "./grading-support.ts";
import type { RubricCriterion } from "./prompting.ts";

type ExistingGradeRecord = {
  ai_score: number | null;
  ai_feedback: string | null;
  ai_breakdown: unknown;
  grading_confidence?: number | null;
};

type RegradeStabilityHelpers = {
  normalizeBreakdown: (raw: unknown, rubric: RubricCriterion[]) => NormalizedBreakdown;
  normalizeOverallScore: (value: unknown, maxScore: number) => number | null;
  detectPositiveFeedbackLowScoreMismatch: (feedback: string, score: number, maxScore: number) => boolean;
  hasMeaningfulScoreDrift: (previousScore: number, nextScore: number, maxScore: number) => boolean;
  requestStructuredGrade: (params: {
    gradingModel: string;
    systemPrompt: string;
    prompt: string;
    rubricLength: number;
    isMathMode: boolean;
  }) => Promise<GradeAIResponse | null>;
};

type FairnessAndReviewHelpers = {
  normalizeMathAnalysis: (raw: unknown) => MathAnalysis | null;
  detectEvidenceCoverage: (params: {
    submissionText: string;
    feedback: string;
    reasonForScore: string;
    evidenceText: string;
  }) => EvidenceCoverage;
  deriveUkBand: (score: number, maxScore: number) => string;
  assessSubmissionRelevance: (params: {
    assignmentTitle: string;
    assignmentInstructions: string;
    rubric: RubricCriterion[];
    submissionText: string;
    feedback: string;
    criterionReasons: string[];
  }) => RelevanceAssessment;
  resolveSingleCriterionFairnessRecalibration: (params: {
    feedback: string;
    reasonForScore: string;
    awardedScore: number;
    evidenceText: string;
    submissionText: string;
    maxScore: number;
    extractionSuccess: boolean;
    extractedTextLength: number;
    integrityRiskHigh: boolean;
  }) => {
    score: number;
    performanceBand: string;
    note: string;
    evidenceCoverage: EvidenceCoverage;
    ukBand: string;
  } | null;
  redistributeBreakdownToTotal: (
    breakdown: GradeBreakdownItem[],
    targetTotal: number,
  ) => GradeBreakdownItem[];
  isNearGradeBoundary: (score: number, maxScore: number) => boolean;
};

export async function applyRegradeStabilityAdjudication(
  {
    previousAiScore,
    normalized,
    assignmentMaxScore,
    stabilityNotes,
    prompt,
    existingGrade,
    gradeResult,
    gradingModel,
    systemPrompt,
    normalizedRubric,
    isMathMode,
    modelFeedback,
  }: {
    previousAiScore: number | null;
    normalized: NormalizedBreakdown;
    assignmentMaxScore: number;
    stabilityNotes: string[];
    prompt: string;
    existingGrade: ExistingGradeRecord | null;
    gradeResult: GradeAIResponse;
    gradingModel: string;
    systemPrompt: string;
    normalizedRubric: RubricCriterion[];
    isMathMode: boolean;
    modelFeedback: string;
  },
  helpers: RegradeStabilityHelpers,
) {
  let nextGradeResult = gradeResult;
  let nextNormalized = normalized;
  let nextModelScore = helpers.normalizeOverallScore(
    nextGradeResult.total_score ?? nextGradeResult.score,
    assignmentMaxScore,
  );
  let nextModelFeedback = modelFeedback;
  let nextScoreAdjusted =
    nextModelScore != null && Math.abs(nextModelScore - nextNormalized.total) > 1;
  let nextPositiveFeedbackLowScoreMismatch = helpers.detectPositiveFeedbackLowScoreMismatch(
    nextModelFeedback,
    nextNormalized.total,
    assignmentMaxScore,
  );
  let regradeVariancePreservedPrior = false;

  if (
    previousAiScore == null ||
    !helpers.hasMeaningfulScoreDrift(previousAiScore, nextNormalized.total, assignmentMaxScore)
  ) {
    return {
      gradeResult: nextGradeResult,
      normalized: nextNormalized,
      modelScore: nextModelScore,
      modelFeedback: nextModelFeedback,
      scoreAdjusted: nextScoreAdjusted,
      positiveFeedbackLowScoreMismatch: nextPositiveFeedbackLowScoreMismatch,
      regradeVariancePreservedPrior,
      stabilityNotes,
    };
  }

  stabilityNotes.push(
    `Regrade drift detected: previous AI score ${previousAiScore}, new AI score ${nextNormalized.total}. Running stability adjudication.`,
  );
  const consistencyPrompt = `${prompt}

The same submission was graded before. The previous stored AI score was ${previousAiScore}. Your current draft score is ${nextNormalized.total}.

Previous stored grade:
${JSON.stringify({
    ai_score: previousAiScore,
    ai_feedback: existingGrade?.ai_feedback ?? "",
    ai_breakdown: Array.isArray(existingGrade?.ai_breakdown) ? existingGrade.ai_breakdown : [],
  })}

Current draft grade:
${JSON.stringify(nextGradeResult)}

STABILITY ADJUDICATION:
- Reconcile the prior and current grades against the same submission evidence.
- Keep the result close to the prior score unless the prior grade clearly misread the rubric.
- If a large score change is justified, explain exactly why in overall_feedback and set lecturer_review_required to true.

Return corrected JSON only.`;
  const stabilized = await helpers.requestStructuredGrade({
    gradingModel,
    systemPrompt,
    prompt: consistencyPrompt,
    rubricLength: normalizedRubric.length,
    isMathMode,
  });

  if (stabilized) {
    nextGradeResult = stabilized;
    nextNormalized = helpers.normalizeBreakdown(
      nextGradeResult.criteria ?? nextGradeResult.breakdown,
      normalizedRubric,
    );
    nextModelScore = helpers.normalizeOverallScore(
      nextGradeResult.total_score ?? nextGradeResult.score,
      assignmentMaxScore,
    );
    nextModelFeedback =
      typeof (nextGradeResult.overall_feedback ?? nextGradeResult.feedback) === "string" &&
        String(nextGradeResult.overall_feedback ?? nextGradeResult.feedback).trim()
        ? String(nextGradeResult.overall_feedback ?? nextGradeResult.feedback).trim()
        : nextModelFeedback;
    nextScoreAdjusted = nextModelScore != null && Math.abs(nextModelScore - nextNormalized.total) > 1;
    nextPositiveFeedbackLowScoreMismatch = helpers.detectPositiveFeedbackLowScoreMismatch(
      nextModelFeedback,
      nextNormalized.total,
      assignmentMaxScore,
    );
    stabilityNotes.push(`Stability adjudication returned score ${nextNormalized.total}.`);
  }

  if (helpers.hasMeaningfulScoreDrift(previousAiScore, nextNormalized.total, assignmentMaxScore)) {
    const previousNormalized = helpers.normalizeBreakdown(existingGrade?.ai_breakdown, normalizedRubric);
    if (previousNormalized.breakdown.length > 0) {
      nextNormalized = {
        ...previousNormalized,
        fairnessNotes: [...previousNormalized.fairnessNotes],
      };
    }
    nextModelScore = previousAiScore;
    nextModelFeedback =
      existingGrade?.ai_feedback?.trim() ||
      "Previous AI grade preserved because repeated regrading produced materially different scores for the same submission.";
    nextScoreAdjusted = false;
    nextPositiveFeedbackLowScoreMismatch = helpers.detectPositiveFeedbackLowScoreMismatch(
      nextModelFeedback,
      nextNormalized.total,
      assignmentMaxScore,
    );
    regradeVariancePreservedPrior = true;
    stabilityNotes.push(
      `Material score drift remained after adjudication, so the prior AI score ${previousAiScore} was preserved and lecturer review was required.`,
    );
  }

  return {
    gradeResult: nextGradeResult,
    normalized: nextNormalized,
    modelScore: nextModelScore,
    modelFeedback: nextModelFeedback,
    scoreAdjusted: nextScoreAdjusted,
    positiveFeedbackLowScoreMismatch: nextPositiveFeedbackLowScoreMismatch,
    regradeVariancePreservedPrior,
    stabilityNotes,
  };
}

export function evaluateFairnessAndReviewState(
  {
    gradeResult,
    normalized,
    modelFeedback,
    blindedText,
    assignmentTitle,
    assignmentInstructions,
    assignmentMaxScore,
    normalizedRubric,
    positiveFeedbackLowScoreMismatch,
    extractionMetadata,
    initialGradingConfidence,
    scoreAdjusted,
    passSpread,
    passSpreadThreshold,
    passScores,
    regradeVariancePreservedPrior,
    stabilityNotes,
    confidenceThreshold,
  }: {
    gradeResult: GradeAIResponse;
    normalized: NormalizedBreakdown;
    modelFeedback: string;
    blindedText: string;
    assignmentTitle: string;
    assignmentInstructions: string;
    assignmentMaxScore: number;
    normalizedRubric: RubricCriterion[];
    positiveFeedbackLowScoreMismatch: boolean;
    extractionMetadata: Record<string, unknown>;
    initialGradingConfidence: number;
    scoreAdjusted: boolean;
    passSpread: number;
    passSpreadThreshold: number;
    passScores: number[];
    regradeVariancePreservedPrior: boolean;
    stabilityNotes: string[];
    confidenceThreshold: number;
  },
  helpers: FairnessAndReviewHelpers,
) {
  const reviewReasons = Array.isArray(gradeResult.review_reasons)
    ? gradeResult.review_reasons.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const mathAnalysis = helpers.normalizeMathAnalysis(gradeResult.math_analysis);
  let nextNormalized = normalized;
  const fairnessNotes = [...nextNormalized.fairnessNotes];
  let gradingConfidence = initialGradingConfidence;
  let fairnessRecalibrationApplied = false;
  const preRecalibrationScore = nextNormalized.total;
  const initialSingleCriterion = nextNormalized.breakdown.length === 1 ? nextNormalized.breakdown[0] : null;
  let evidenceCoverage = initialSingleCriterion
    ? helpers.detectEvidenceCoverage({
      submissionText: blindedText,
      feedback: modelFeedback,
      reasonForScore: initialSingleCriterion.reason_for_score,
      evidenceText: initialSingleCriterion.evidence_from_submission,
    })
    : null;
  let ukBand = helpers.deriveUkBand(nextNormalized.total, assignmentMaxScore);
  const relevanceAssessment = helpers.assessSubmissionRelevance({
    assignmentTitle,
    assignmentInstructions,
    rubric: normalizedRubric,
    submissionText: blindedText,
    feedback: modelFeedback,
    criterionReasons: nextNormalized.breakdown.map((item) => item.reason_for_score),
  });
  const relevanceBlocksFairness = relevanceAssessment.classification !== "RELEVANT";

  if (positiveFeedbackLowScoreMismatch && nextNormalized.breakdown.length === 1) {
    const single = nextNormalized.breakdown[0];
    const integrityRiskHigh =
      Boolean(mathAnalysis?.solver_signals.length) ||
      reviewReasons.some((reason) =>
        /academic integrity|suspected ai|inconsistent voice|implausible sophistication/i.test(reason)
      );
    if (!relevanceBlocksFairness) {
      const recalibratedBand = helpers.resolveSingleCriterionFairnessRecalibration({
        feedback: modelFeedback,
        reasonForScore: single.reason_for_score,
        awardedScore: single.score,
        evidenceText: single.evidence_from_submission,
        submissionText: blindedText,
        maxScore: assignmentMaxScore,
        extractionSuccess: extractionMetadata.extraction_success === true,
        extractedTextLength: Number(extractionMetadata.extracted_text_length || 0),
        integrityRiskHigh,
      });
      if (recalibratedBand != null && nextNormalized.total < recalibratedBand.score) {
        nextNormalized = {
          ...nextNormalized,
          breakdown: nextNormalized.breakdown.map((item) => ({
            ...item,
            score: recalibratedBand.score,
            performance_band: recalibratedBand.performanceBand,
            confidence_score: Math.min(item.confidence_score, 0.7),
            review_required: true,
          })),
          total: recalibratedBand.score,
        };
        fairnessNotes.push(recalibratedBand.note);
        gradingConfidence = Math.min(gradingConfidence, 0.7);
        fairnessRecalibrationApplied = true;
        evidenceCoverage = recalibratedBand.evidenceCoverage;
        ukBand = recalibratedBand.ukBand;
      }
    }
  }

  if (
    !fairnessRecalibrationApplied &&
    evidenceCoverage &&
    nextNormalized.breakdown.length === 1 &&
    !(mathAnalysis?.solver_signals.length) &&
    !relevanceBlocksFairness
  ) {
    let coverageTarget: number | null = null;
    if (
      evidenceCoverage.coverage_count >= 7 &&
      evidenceCoverage.two_methods_present &&
      evidenceCoverage.interpretation_present &&
      evidenceCoverage.methods_relevant &&
      nextNormalized.total < 60
    ) {
      coverageTarget = 60;
    } else if (evidenceCoverage.coverage_count >= 6 && nextNormalized.total < 55) {
      coverageTarget = 60;
    } else if (evidenceCoverage.coverage_count >= 5 && nextNormalized.total < 50) {
      coverageTarget = 55;
    }

    if (coverageTarget != null) {
      const currentBand = helpers.deriveUkBand(coverageTarget, assignmentMaxScore);
      nextNormalized = {
        ...nextNormalized,
        breakdown: nextNormalized.breakdown.map((item) => ({
          ...item,
          score: coverageTarget as number,
          performance_band: coverageTarget >= 60 ? "Good" : "Satisfactory",
          confidence_score: Math.min(item.confidence_score, 0.7),
          review_required: true,
        })),
        total: coverageTarget,
      };
      fairnessNotes.push(
        "Score recalibrated using UK university marking bands because the submission met the main assignment requirements and the original score was below the expected band.",
      );
      gradingConfidence = Math.min(gradingConfidence, 0.7);
      fairnessRecalibrationApplied = true;
      ukBand = currentBand;
    }
  }

  if (relevanceAssessment.classification === "OFF_TOPIC") {
    fairnessNotes.push("Fairness recalibration skipped because the submission does not address the assignment instruction.");
    gradingConfidence = Math.min(gradingConfidence, 0.7);
  } else if (relevanceAssessment.classification === "PARTIALLY_RELEVANT") {
    fairnessNotes.push("Fairness recalibration skipped because the submission addresses the wrong task.");
    gradingConfidence = Math.min(gradingConfidence, 0.7);
  }

  if (relevanceAssessment.classification !== "RELEVANT" && nextNormalized.total >= 40) {
    const cappedScore = relevanceAssessment.classification === "OFF_TOPIC"
      ? Math.min(preRecalibrationScore, 20)
      : Math.min(preRecalibrationScore, 39);
    nextNormalized = {
      ...nextNormalized,
      breakdown: helpers.redistributeBreakdownToTotal(nextNormalized.breakdown, cappedScore),
      total: cappedScore,
    };
    fairnessNotes.push(
      "Score corrected because fairness recalibration attempted to raise a non-relevant submission into a passing band.",
    );
    gradingConfidence = Math.min(gradingConfidence, 0.7);
    fairnessRecalibrationApplied = false;
  }

  ukBand = helpers.deriveUkBand(nextNormalized.total, assignmentMaxScore);
  if (scoreAdjusted) {
    fairnessNotes.push("Total score was recalculated to match the exact sum of criterion awarded_scores.");
  }
  if (helpers.isNearGradeBoundary(nextNormalized.total, assignmentMaxScore)) {
    reviewReasons.push("Total score falls within 3 marks of a grade boundary.");
  }

  if (mathAnalysis?.solver_signals.length) {
    reviewReasons.push(...mathAnalysis.solver_signals.map((signal) => `Solver signal: ${signal}`));
  }

  reviewReasons.push(...nextNormalized.reviewReasons);
  if (positiveFeedbackLowScoreMismatch && !fairnessRecalibrationApplied) {
    reviewReasons.push("Score/feedback mismatch: positive rubric summary paired with a mark below 40%");
    fairnessNotes.push("Fairness warning: positive feedback was paired with a fail-range score.");
  }
  if (nextNormalized.recalibrated) {
    reviewReasons.push("One or more criterion scores were recalibrated during backend validation.");
  }
  if (fairnessRecalibrationApplied) {
    reviewReasons.push("UK band fairness recalibration applied.");
  }
  if (relevanceAssessment.classification !== "RELEVANT") {
    reviewReasons.push(...relevanceAssessment.reasons);
  }
  if (regradeVariancePreservedPrior) {
    reviewReasons.push("Repeated regrading produced materially different scores, so the prior AI grade was preserved.");
  }
  if (passSpread >= passSpreadThreshold) {
    reviewReasons.push(
      `Consensus grading spread was ${passSpread} across ${passScores.length} passes, exceeding the review threshold of ${passSpreadThreshold}.`,
    );
  }

  const recalibrationApplied =
    fairnessRecalibrationApplied ||
    nextNormalized.recalibrated ||
    scoreAdjusted ||
    positiveFeedbackLowScoreMismatch;
  if (recalibrationApplied) {
    gradingConfidence = Math.min(gradingConfidence, 0.7);
  }

  const requiresLecturerReview =
    Boolean(gradeResult.lecturer_review_required ?? gradeResult.requires_lecturer_review) ||
    gradingConfidence < confidenceThreshold ||
    nextNormalized.breakdown.some((item) => item.review_required) ||
    Boolean(mathAnalysis?.solver_signals.length) ||
    positiveFeedbackLowScoreMismatch ||
    nextNormalized.recalibrated ||
    fairnessRecalibrationApplied ||
    relevanceAssessment.classification !== "RELEVANT" ||
    passSpread >= passSpreadThreshold ||
    regradeVariancePreservedPrior ||
    helpers.isNearGradeBoundary(nextNormalized.total, assignmentMaxScore);

  const feedbackParts = [modelFeedback];
  if (scoreAdjusted) {
    feedbackParts.push("Final score was recalculated to match the exact sum of criterion scores.");
  }
  if (fairnessRecalibrationApplied && fairnessNotes.length > 0) {
    feedbackParts.push(fairnessNotes[fairnessNotes.length - 1]);
  }
  if (stabilityNotes.length > 0) {
    feedbackParts.push(stabilityNotes[stabilityNotes.length - 1]);
  }
  if (requiresLecturerReview && reviewReasons.length > 0) {
    feedbackParts.push(`Lecturer review recommended: ${Array.from(new Set(reviewReasons)).join("; ")}`);
  }

  return {
    normalized: nextNormalized,
    gradingConfidence,
    reviewReasons,
    mathAnalysis,
    fairnessNotes,
    fairnessRecalibrationApplied,
    evidenceCoverage,
    ukBand,
    relevanceAssessment,
    recalibrationApplied,
    requiresLecturerReview,
    feedbackParts,
  };
}
