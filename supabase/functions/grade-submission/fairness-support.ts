import type { GradeBreakdownItem } from "./grading-support.ts";
import type { RubricCriterion } from "./prompting.ts";

export type EvidenceCoverage = {
  dataset_selected: boolean;
  cleaning_present: boolean;
  eda_present: boolean;
  two_methods_present: boolean;
  interpretation_present: boolean;
  visualisation_present: boolean;
  conclusion_present: boolean;
  coverage_count: number;
  methods_relevant: boolean;
};

export type RelevanceClassification = "RELEVANT" | "PARTIALLY_RELEVANT" | "OFF_TOPIC";

export type RelevanceAssessment = {
  classification: RelevanceClassification;
  reasons: string[];
};

function includesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function countMatches(text: string, patterns: RegExp[]) {
  return patterns.filter((pattern) => pattern.test(text)).length;
}

export function detectEvidenceCoverage({
  submissionText,
  feedback,
  reasonForScore,
  evidenceText,
}: {
  submissionText: string;
  feedback: string;
  reasonForScore: string;
  evidenceText: string;
}): EvidenceCoverage {
  const combined = `${submissionText}\n${feedback}\n${reasonForScore}\n${evidenceText}`.toLowerCase();
  const methodPatterns = [
    /\bregression\b/,
    /\blinear regression\b/,
    /\blogistic regression\b/,
    /\bclustering\b/,
    /\bk-?means\b/,
    /\bclassification\b/,
    /\bdecision tree\b/,
    /\brandom forest\b/,
    /\banova\b/,
    /\bcorrelation\b/,
    /\bforecast(?:ing)?\b/,
    /\btime series\b/,
    /\bpca\b/,
    /\bprincipal component analysis\b/,
    /\bhypothesis test(?:ing)?\b/,
    /\bchi-?square\b/,
  ];
  const matchedMethods = methodPatterns.filter((pattern) => pattern.test(combined)).length;

  const coverage = {
    dataset_selected: includesAny(combined, [
      /\bdataset\b/,
      /\bdata set\b/,
      /\bselected data\b/,
      /\bchosen data\b/,
      /\bsource data\b/,
    ]),
    cleaning_present: includesAny(combined, [
      /\bclean(?:ing|ed)?\b/,
      /\bpreprocessing\b/,
      /\bpre-?process(?:ing|ed)?\b/,
      /\bmissing values?\b/,
      /\boutlier(?:s)?\b/,
      /\bnormalis(?:e|ed|ation)\b/,
      /\bstandardis(?:e|ed|ation)\b/,
    ]),
    eda_present: includesAny(combined, [
      /\beda\b/,
      /\bexploratory analysis\b/,
      /\bexploratory data analysis\b/,
      /\bdescriptive statistics?\b/,
      /\bsummary statistics?\b/,
      /\bdistribution\b/,
    ]),
    two_methods_present:
      matchedMethods >= 2 ||
      includesAny(combined, [
        /\btwo analytical techniques\b/,
        /\btwo analytical techniques attempted\b/,
        /\bsecond analytical technique\b/,
        /\bmultiple analytical techniques\b/,
      ]),
    interpretation_present: includesAny(combined, [
      /\binterpret(?:ation|ed|s)?\b/,
      /\breasonable interpretation\b/,
      /\bfindings suggest\b/,
      /\bresults indicate\b/,
      /\bthis shows\b/,
      /\bexplains the results\b/,
    ]),
    visualisation_present: includesAny(combined, [
      /\bvisuali[sz]ation\b/,
      /\bplot(?:s)?\b/,
      /\bchart(?:s)?\b/,
      /\bgraph(?:s)?\b/,
      /\bfigure(?:s)?\b/,
      /\bhistogram\b/,
      /\bscatter\b/,
      /\bbox plot\b/,
    ]),
    conclusion_present: includesAny(combined, [
      /\bconclusion\b/,
      /\blimitation(?:s)?\b/,
      /\bsummary\b/,
      /\bconclude(?:d|s)?\b/,
      /\brecommendation(?:s)?\b/,
      /\bfinal remarks?\b/,
    ]),
    coverage_count: 0,
    methods_relevant:
      matchedMethods >= 1 ||
      includesAny(combined, [/\brelevant methods?\b/, /\bappropriate methods?\b/, /\bcorrect methods?\b/]),
  };

  coverage.coverage_count = [
    coverage.dataset_selected,
    coverage.cleaning_present,
    coverage.eda_present,
    coverage.two_methods_present,
    coverage.interpretation_present,
    coverage.visualisation_present,
    coverage.conclusion_present,
  ].filter(Boolean).length;

  return coverage;
}

export function deriveUkBand(score: number, maxScore: number) {
  const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (percent >= 70) return "First class / distinction";
  if (percent >= 60) return "Upper second / merit";
  if (percent >= 50) return "Lower second / satisfactory";
  if (percent >= 40) return "Third / basic pass";
  if (percent >= 30) return "Fail";
  return "Clear fail";
}

export function redistributeBreakdownToTotal(breakdown: GradeBreakdownItem[], targetTotal: number) {
  if (breakdown.length === 0) return breakdown;

  let remaining = Math.max(0, Number(targetTotal.toFixed(2)));

  return breakdown.map((item, index) => {
    const nextScore = index === 0 ? Math.min(item.max_score, remaining) : 0;
    remaining = Math.max(0, remaining - nextScore);
    return {
      ...item,
      score: nextScore,
      review_required: true,
    };
  });
}

function roundCriterionFloor(score: number) {
  return Number(score.toFixed(2));
}

function getPerformanceBandFloorRatio(performanceBand: string) {
  const normalized = performanceBand.toLowerCase();
  if (normalized.includes("excellent")) return 0.85;
  if (normalized.includes("good")) return 0.7;
  if (normalized.includes("satisfactory")) return 0.55;
  if (normalized.includes("basic")) return 0.4;
  return null;
}

function detectCriterionBandFloor(item: GradeBreakdownItem) {
  const combined = [
    item.performance_band,
    item.comment,
    item.reason_for_score,
    item.evidence_from_submission,
    ...item.strengths,
  ].join(" ").toLowerCase();

  const excellentSignals = [
    "excellent",
    "outstanding",
    "insightful",
    "strong analytical insight",
    "well-developed analysis",
    "high quality",
  ];
  const goodSignals = [
    "good",
    "solid",
    "strong",
    "coherent",
    "clear",
    "well-justified",
    "appropriate",
    "defensible",
    "logical",
    "correct",
    "accurate",
    "meets all core requirements",
    "meets the core requirements",
    "clear trade-off",
    "clear trade off",
  ];
  const satisfactorySignals = [
    "satisfactory",
    "competent",
    "relevant",
    "addresses the task",
    "addresses the criterion",
    "meets requirements",
    "reasonable interpretation",
    "sound",
  ];
  const harshLimiters = [
    "incorrect",
    "inaccurate",
    "off-topic",
    "fails to meet",
    "little evidence",
    "no evidence",
    "missing key",
    "missing keys",
    "serious error",
    "major flaw",
  ];

  if (harshLimiters.some((signal) => combined.includes(signal))) {
    return null;
  }

  const performanceBandFloorRatio = getPerformanceBandFloorRatio(item.performance_band);
  let floor: { score: number; performanceBand: string } | null =
    performanceBandFloorRatio == null
      ? null
      : {
          score: roundCriterionFloor(item.max_score * performanceBandFloorRatio),
          performanceBand: item.performance_band,
        };

  if (excellentSignals.some((signal) => combined.includes(signal))) {
    floor = {
      score: roundCriterionFloor(item.max_score * 0.85),
      performanceBand: "Excellent",
    };
  } else if (goodSignals.some((signal) => combined.includes(signal))) {
    floor = {
      score: roundCriterionFloor(item.max_score * 0.7),
      performanceBand: "Good",
    };
  } else if (satisfactorySignals.some((signal) => combined.includes(signal))) {
    floor = {
      score: roundCriterionFloor(item.max_score * 0.55),
      performanceBand: "Satisfactory",
    };
  }

  return floor;
}

export function applyCriterionBandFloorRecalibration({
  breakdown,
  extractionSuccess,
  extractedTextLength,
}: {
  breakdown: GradeBreakdownItem[];
  extractionSuccess: boolean;
  extractedTextLength: number;
}) {
  if (!extractionSuccess || extractedTextLength < 400) {
    return {
      breakdown,
      total: Number(breakdown.reduce((sum, item) => sum + item.score, 0).toFixed(2)),
      notes: [] as string[],
      changed: false,
    };
  }

  const notes: string[] = [];
  let changed = false;

  const nextBreakdown = breakdown.map((item) => {
    const floor = detectCriterionBandFloor(item);
    if (!floor || item.score >= floor.score) {
      return item;
    }

    changed = true;
    notes.push(
      `${item.criterion}: criterion score was lifted to the ${floor.performanceBand} floor because the criterion feedback described stronger work than the original mark reflected.`,
    );

    return {
      ...item,
      score: floor.score,
      performance_band: floor.performanceBand,
      confidence_score: Math.min(item.confidence_score, 0.7),
      review_required: true,
    };
  });

  return {
    breakdown: nextBreakdown,
    total: Number(nextBreakdown.reduce((sum, item) => sum + item.score, 0).toFixed(2)),
    notes,
    changed,
  };
}

function extractKeywordSet(text: string) {
  const stopWords = new Set([
    "the", "and", "for", "with", "that", "this", "from", "into", "about", "your", "their", "have", "has", "had",
    "were", "was", "are", "is", "be", "been", "being", "will", "shall", "would", "could", "should", "can", "may",
    "might", "must", "than", "then", "them", "they", "you", "our", "out", "but", "not", "all", "any", "each",
    "using", "use", "used", "within", "which", "what", "when", "where", "while", "into", "onto", "upon", "also",
    "only", "main", "core", "work", "task", "assignment", "brief", "report", "submission", "criterion", "criteria",
    "student", "students", "required", "requirements",
  ]);

  return new Set(
    text
      .toLowerCase()
      .match(/[a-z][a-z0-9_-]{2,}/g)?.filter((token) => !stopWords.has(token)) ?? [],
  );
}

export function assessSubmissionRelevance({
  assignmentTitle,
  assignmentInstructions,
  rubric,
  submissionText,
  feedback,
  criterionReasons,
}: {
  assignmentTitle: string;
  assignmentInstructions: string;
  rubric: RubricCriterion[];
  submissionText: string;
  feedback: string;
  criterionReasons: string[];
}): RelevanceAssessment {
  const combinedEvaluatorText = `${feedback}\n${criterionReasons.join("\n")}`.toLowerCase();
  const redFlagPatterns = [
    /off-topic/,
    /does not address the required task/,
    /no relevant evidence/,
    /cannot be credited against this assignment/,
    /unrelated to the assignment instruction/,
    /wrong subject/,
    /wrong task/,
  ];

  const matchedRedFlags = redFlagPatterns.filter((pattern) => pattern.test(combinedEvaluatorText));
  if (matchedRedFlags.length > 0) {
    const explicitWrongTask = matchedRedFlags.some((pattern) =>
      /off-topic|wrong task|wrong subject|unrelated to the assignment instruction|cannot be credited against this assignment/.test(
        pattern.source,
      )
    );
    return {
      classification: explicitWrongTask ? "OFF_TOPIC" : "PARTIALLY_RELEVANT",
      reasons: ["Evaluator feedback indicates the submission does not answer the assignment instruction."],
    };
  }

  const assignmentKeywords = extractKeywordSet(
    `${assignmentTitle}\n${assignmentInstructions}\n${rubric.map((item) => `${item.criterion} ${item.description ?? ""}`).join("\n")}`,
  );
  const submissionKeywords = extractKeywordSet(submissionText);
  const overlapCount = Array.from(assignmentKeywords).filter((keyword) => submissionKeywords.has(keyword)).length;

  const rubricCriteriaMatched = rubric.filter((criterion) => {
    const criterionKeywords = extractKeywordSet(`${criterion.criterion} ${criterion.description ?? ""}`);
    const criterionOverlap = Array.from(criterionKeywords).filter((keyword) => submissionKeywords.has(keyword)).length;
    return criterionOverlap > 0;
  }).length;

  const relevantSignals = [
    "relevant",
    "addresses the task",
    "addresses the brief",
    "meets requirements",
    "maps to the rubric",
    "clear evidence",
    "reasonable interpretation",
  ].filter((signal) => combinedEvaluatorText.includes(signal)).length;

  const briefSpecificityHigh = assignmentKeywords.size >= 6;

  if (overlapCount === 0 && rubricCriteriaMatched === 0 && relevantSignals === 0) {
    return {
      classification: "OFF_TOPIC",
      reasons: ["Submission text does not align with assignment or rubric keywords."],
    };
  }

  if (
    rubricCriteriaMatched === 0 ||
    (briefSpecificityHigh && overlapCount <= 1) ||
    (overlapCount <= 2 && relevantSignals === 0)
  ) {
    return {
      classification: "PARTIALLY_RELEVANT",
      reasons: ["Submission touches the broad area but does not map clearly to the required task."],
    };
  }

  return {
    classification: "RELEVANT",
    reasons: ["Submission content aligns with the assignment instruction and rubric."],
  };
}

export function isNearGradeBoundary(score: number, maxScore: number) {
  const boundaries = [40, 50, 60, 70];
  return boundaries.some((boundaryPercent) => {
    const boundaryMark = (maxScore * boundaryPercent) / 100;
    return Math.abs(score - boundaryMark) <= 3;
  });
}

export function resolveSingleCriterionFairnessRecalibration({
  feedback,
  reasonForScore,
  awardedScore,
  evidenceText,
  submissionText,
  maxScore,
  extractionSuccess,
  extractedTextLength,
  integrityRiskHigh,
}: {
  feedback: string;
  reasonForScore: string;
  awardedScore: number;
  evidenceText: string;
  submissionText: string;
  maxScore: number;
  extractionSuccess: boolean;
  extractedTextLength: number;
  integrityRiskHigh: boolean;
}) {
  const combined = `${feedback} ${reasonForScore}`.toLowerCase();
  const evidence = evidenceText.toLowerCase().trim();
  const evidenceCoverage = detectEvidenceCoverage({
    submissionText,
    feedback,
    reasonForScore,
    evidenceText,
  });

  if (!extractionSuccess || extractedTextLength <= 0) return null;
  if (!evidence || evidence === "no supporting quote extracted.") return null;
  if (integrityRiskHigh) return null;

  const disqualifiers = [
    "little or no relevant evidence",
    "no relevant evidence",
    "off-topic",
    "blank submission",
    "unreadable",
    "gibberish",
    "fails to meet",
  ];
  if (disqualifiers.some((signal) => combined.includes(signal))) return null;

  const excellentSignals = [
    "excellent",
    "critical analysis",
    "strong evidence",
    "clear analytical insight",
    "insightful",
    "well-developed analysis",
  ];
  const goodBandSignals = [
    "good",
    "solid",
    "strong",
    "solid report",
    "good standard",
    "solid/good",
    "good depth",
    "clear analytical insight",
  ];
  const satisfactorySignals = [
    "competent",
    "coherent",
    "relevant",
    "relevant and coherent",
    "clear topic",
    "sensible preprocessing",
    "appropriate exploratory analysis",
    "addresses the main requirements",
    "meets core requirements",
    "meets the core requirements",
    "meets all core requirements",
    "meets requirements",
    "clear evidence",
    "addresses task",
    "addresses the task",
    "reasonable interpretation",
    "clear",
    "two analytical techniques",
    "two analytical techniques attempted",
    "logical interpretation",
  ];
  const methodsAndCoverageSignals = [
    /\bpreprocessing\b/,
    /\bexploratory analysis\b/,
    /\bexploratory data analysis\b/,
    /\btwo analytical techniques(?: attempted)?\b/,
    /\breasonable interpretation\b/,
    /\bvisuali[sz]ation\b/,
    /\bconclusion\b/,
    /\blimitations?\b/,
  ];
  const positiveRubricSignals = [
    /\bcompetent\b/,
    /\bcoherent\b/,
    /\brelevant\b/,
    /\bclear topic\b/,
    /\bmeets (?:the )?main requirements\b/,
    /\bmeets (?:all )?core requirements\b/,
    /\bappropriate exploratory analysis\b/,
    /\bsensible preprocessing\b/,
    /\btwo analytical techniques(?: attempted)?\b/,
    /\breasonable interpretation\b/,
  ];

  const hasExcellentSignals = excellentSignals.some((signal) => combined.includes(signal));
  const hasGoodSignals = goodBandSignals.some((signal) => combined.includes(signal));
  const hasSatisfactorySignals = satisfactorySignals.some((signal) => combined.includes(signal));
  const positiveSignalCount = countMatches(combined, positiveRubricSignals);
  const methodsSignalCount = countMatches(combined, methodsAndCoverageSignals);

  let targetScore: number | null = null;
  let performanceBand = "Satisfactory";
  let note =
    "Score recalibrated using UK university marking bands because the submission met the main assignment requirements and the original score was below the expected band.";

  if (
    evidenceCoverage.coverage_count >= 7 &&
    evidenceCoverage.two_methods_present &&
    evidenceCoverage.interpretation_present &&
    evidenceCoverage.methods_relevant
  ) {
    if (hasExcellentSignals) {
      targetScore = 76;
      performanceBand = "Excellent";
      note =
        "Score recalibrated using UK university marking bands because the submission covered all required components with strong analysis and evidence.";
    } else if (hasGoodSignals) {
      targetScore = 70;
      performanceBand = "Good";
      note =
        "Score recalibrated to the Good band because the submission showed good depth, relevant methods, and clear analytical insight.";
    } else {
      targetScore = 64;
      performanceBand = "Good";
      note =
        "Score recalibrated to the upper-second band because the submission covered all core requirements with reasonable methods and interpretation.";
    }
  } else if (evidenceCoverage.coverage_count >= 6 && evidenceCoverage.interpretation_present) {
    targetScore = hasGoodSignals ? 68 : 60;
    performanceBand = "Good";
    note =
      "Score recalibrated using UK university marking bands because the submission met the main requirements with reasonable methods and interpretation.";
  } else if (evidenceCoverage.coverage_count >= 5) {
    targetScore = hasGoodSignals ? 62 : 55;
    performanceBand = "Satisfactory";
    note =
      "Score recalibrated to Satisfactory band because feedback indicates the work meets core requirements.";
  } else if (awardedScore < 40 && methodsSignalCount >= 3) {
    targetScore = hasGoodSignals || evidenceCoverage.interpretation_present ? 60 : 55;
    performanceBand = targetScore >= 60 ? "Good" : "Satisfactory";
    note =
      "Score recalibrated using UK university marking bands because the feedback described clear preprocessing, exploratory analysis, and multiple analytical techniques.";
  } else if (awardedScore < 40 && hasGoodSignals) {
    return {
      score: Math.min(maxScore, 65),
      performanceBand: "Good",
      ukBand: deriveUkBand(Math.min(maxScore, 65), maxScore),
      evidenceCoverage,
      note:
        "Score recalibrated to the Good band because feedback indicates the work is good/solid/strong, even though the original mark was too low.",
    };
  }

  if (targetScore == null && awardedScore < 40 && hasSatisfactorySignals) {
    targetScore = 55;
    performanceBand = "Satisfactory";
    note =
      "Score recalibrated to Satisfactory band because feedback indicates the work meets core requirements.";
  }

  if (targetScore == null && awardedScore < 40 && positiveSignalCount >= 2) {
    targetScore = methodsSignalCount >= 3 ? 60 : 55;
    performanceBand = targetScore >= 60 ? "Good" : "Satisfactory";
    note =
      targetScore >= 60
        ? "Score recalibrated to the upper-second band because the feedback describes competent work with relevant analytical methods."
        : "Score recalibrated to Satisfactory band because the feedback describes competent, relevant work that meets the task.";
  }

  if (targetScore == null || awardedScore >= targetScore) return null;

  return {
    score: Math.min(maxScore, targetScore),
    performanceBand,
    ukBand: deriveUkBand(Math.min(maxScore, targetScore), maxScore),
    evidenceCoverage,
    note,
  };
}
