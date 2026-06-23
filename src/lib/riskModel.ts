import type { AtRiskStudent, StudentTrajectory } from "@/lib/studentRisk";

import type { RiskModelClassName } from "@/lib/riskModelArtifactTypes";
import { scoreRiskModelArtifact } from "@/lib/riskModelPipeline";
import { getRiskModelArtifact } from "@/lib/riskModelRegistry";

export const RISK_FEATURE_VERSION = "trajectory-v1";

export type RiskModelPrediction = {
  modelVersion: string;
  featureVersion: string;
  generatedAt: string;
  className: RiskModelClassName;
  riskBand: RiskModelClassName;
  riskScore: number;
  confidence: number;
  confidenceScore: number;
  needsReview: boolean;
  reviewReasons: string[];
  probabilityByBand: Record<RiskModelClassName, number>;
  featureVector: Record<string, number>;
  calibrationMetrics: {
    calibrationTemperature: number | null;
    validationNll: number | null;
    validationConfidenceEce: number | null;
    trainAccuracy: number | null;
    testAccuracy: number | null;
  };
  advisoryOnly: true;
};

const FEATURE_NAMES = [
  "scoreCount",
  "average",
  "last",
  "minimum",
  "maximum",
  "slope",
  "predictedNext",
  "stdDev",
  "recent3Avg",
  "earlyAvg",
  "firstLastDelta",
  "recentDelta",
  "below50Ratio",
  "below40Ratio",
] as const;

type RiskFeatureName = (typeof FEATURE_NAMES)[number];
type RiskFeatureVector = Record<RiskFeatureName, number> & {
  volatility: number;
};

function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let index = 0; index < n; index += 1) {
    sumX += index;
    sumY += values[index];
    sumXY += index * values[index];
    sumXX += index * index;
  }

  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[], average: number) {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatReviewReason(reason: string) {
  switch (reason) {
    case "low_confidence":
      return "Model confidence is low";
    case "small_margin":
      return "Top risk bands are close together";
    case "short_history":
      return "Assessment history is short";
    case "volatile_pattern":
      return "Performance pattern is volatile";
    case "boundary_pattern":
      return "Trajectory sits near a decision boundary";
    case "near_threshold":
      return "Trajectory is near the risk threshold";
    case "sharp_decline":
      return "Sharp decline detected";
    default:
      return reason.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function buildRiskRecommendation(prediction: RiskModelPrediction): string {
  const average = prediction.featureVector.average ?? 0;
  const last = prediction.featureVector.last ?? 0;
  const slope = prediction.featureVector.slope ?? 0;
  const predictedNext = prediction.featureVector.predictedNext ?? 0;

  if (prediction.reviewReasons.includes("sharp_decline") || slope < -3) {
    return "Urgent: schedule a 1-on-1 meeting to discuss grade trajectory.";
  }
  if (average < 40) {
    return "Refer to student support services and consider tutoring.";
  }
  if (last < average - 15) {
    return "Recent performance dipped sharply. Check for academic or personal barriers.";
  }
  if (predictedNext < 40) {
    return "The current assessment pattern suggests this student may need support before the next deadline.";
  }
  if (prediction.reviewReasons.includes("short_history") || prediction.reviewReasons.includes("low_confidence")) {
    return "Data is limited. Monitor closely after the next submission.";
  }

  return "Schedule a check-in to review study strategies and agree short-term goals.";
}

export function mapRiskModelPredictionToAtRiskStudent(
  trajectory: StudentTrajectory,
  prediction: RiskModelPrediction | null,
): AtRiskStudent | null {
  if (!prediction || prediction.riskScore < 25) return null;

  const average = prediction.featureVector.average ?? 0;
  const last = prediction.featureVector.last ?? 0;
  const slope = prediction.featureVector.slope ?? 0;

  return {
    name: trajectory.name,
    email: trajectory.email,
    studentId: trajectory.studentId,
    riskScore: prediction.riskScore,
    riskLevel: prediction.riskScore >= 70 ? "critical" : prediction.riskScore >= 45 ? "high" : "moderate",
    avgGrade: Math.round(average),
    lastGrade: Math.round(last),
    trend: slope < -1 ? "declining" : average < 50 ? "stable-low" : "volatile",
    reasonCodes: prediction.reviewReasons,
    flags: prediction.reviewReasons.map(formatReviewReason),
    sparkline: trajectory.scores.slice(-6).map((entry) => entry.score),
    recommendation: buildRiskRecommendation(prediction),
    predictedNext: Math.round(prediction.featureVector.predictedNext ?? 0),
  };
}

export function extractRiskFeatures(trajectory: StudentTrajectory): RiskFeatureVector {
  const scores = trajectory.scores.map((entry) => entry.score);
  const average = mean(scores);
  const last = scores[scores.length - 1] ?? 0;
  const minimum = scores.length > 0 ? Math.min(...scores) : 0;
  const maximum = scores.length > 0 ? Math.max(...scores) : 0;
  const { slope, intercept } = linearRegression(scores);
  const predictedNext = clamp(slope * scores.length + intercept, 0, 100);
  const stdDev = standardDeviation(scores, average);
  const recent3Avg = mean(scores.slice(-3));
  const earlyAvg = mean(scores.slice(0, Math.max(1, Math.floor(scores.length / 2))));
  const firstLastDelta = scores.length > 0 ? last - (scores[0] ?? 0) : 0;
  const recentDelta = scores.length >= 2 ? last - scores[scores.length - 2] : 0;
  const below50Ratio = scores.length > 0 ? scores.filter((score) => score < 50).length / scores.length : 0;
  const below40Ratio = scores.length > 0 ? scores.filter((score) => score < 40).length / scores.length : 0;
  const volatility = stdDev;

  return {
    scoreCount: scores.length,
    average,
    last,
    minimum,
    maximum,
    slope,
    predictedNext,
    stdDev,
    recent3Avg,
    earlyAvg,
    firstLastDelta,
    recentDelta,
    below50Ratio,
    below40Ratio,
    volatility,
  };
}

function blendWithUniform(probabilities: number[], blendFactor: number): number[] {
  const safeBlend = clamp(blendFactor, 0, 1);
  const uniform = 1 / Math.max(1, probabilities.length);
  return probabilities.map((probability) => probability * (1 - safeBlend) + uniform * safeBlend);
}

function computeConservatism(features: RiskFeatureVector, ranked: { probability: number }[]): number {
  const topProbability = ranked[0]?.probability ?? 0;
  const secondProbability = ranked[1]?.probability ?? 0;
  const margin = clamp(topProbability - secondProbability, 0, 1);

  const marginPenalty = clamp((0.5 - margin) / 0.5, 0, 1);
  const historyPenalty = clamp((5 - features.scoreCount) / 5, 0, 1);
  const volatilityPenalty = clamp((features.volatility - 5) / 12, 0, 1);
  const boundaryAveragePenalty = clamp(1 - Math.abs(features.average - 55) / 11, 0, 1);
  const boundaryTrendPenalty = clamp(1 - Math.abs(features.predictedNext - 55) / 13, 0, 1);
  const boundaryPenalty = boundaryAveragePenalty * 0.6 + boundaryTrendPenalty * 0.4;

  return clamp(
    marginPenalty * 0.35 + historyPenalty * 0.15 + volatilityPenalty * 0.15 + boundaryPenalty * 0.35,
    0,
    0.8,
  );
}

function computeBoundarySoftening(features: RiskFeatureVector): number {
  const boundaryAveragePenalty = clamp(1 - Math.abs(features.average - 55) / 9, 0, 1);
  const boundaryTrendPenalty = clamp(1 - Math.abs(features.predictedNext - 55) / 11, 0, 1);
  const shortHistoryPenalty = clamp((5 - features.scoreCount) / 5, 0, 1);
  const volatilityPenalty = clamp((features.volatility - 4) / 10, 0, 1);

  return clamp(
    boundaryAveragePenalty * 0.35 +
      boundaryTrendPenalty * 0.25 +
      shortHistoryPenalty * 0.2 +
      volatilityPenalty * 0.2,
    0,
    0.4,
  );
}

function buildReviewReasons(
  features: RiskFeatureVector,
  ranked: { probability: number }[],
  confidenceProbability: number,
): string[] {
  const reasons = new Set<string>();
  const topProbability = ranked[0]?.probability ?? 0;
  const secondProbability = ranked[1]?.probability ?? 0;
  const margin = clamp(topProbability - secondProbability, 0, 1);
  const boundarySoftening = computeBoundarySoftening(features);

  if (confidenceProbability < 0.7) reasons.add("low_confidence");
  if (margin < 0.18) reasons.add("small_margin");
  if (features.scoreCount < 3) reasons.add("short_history");
  if (features.volatility >= 9.5) reasons.add("volatile_pattern");
  if (boundarySoftening >= 0.35) reasons.add("boundary_pattern");
  if (Math.abs(features.average - 55) <= 5 || Math.abs(features.predictedNext - 55) <= 5) {
    reasons.add("near_threshold");
  }
  if (
    features.slope <= -4 ||
    features.recentDelta <= -10 ||
    features.firstLastDelta <= -18 ||
    features.below40Ratio >= 0.25
  ) {
    reasons.add("sharp_decline");
  }

  return Array.from(reasons);
}

export function scoreStudentRisk(
  trajectory: StudentTrajectory,
  options?: {
    featureVersion?: string;
    generatedAt?: string;
  },
): RiskModelPrediction | null {
  const riskModelArtifact = getRiskModelArtifact();
  if (!riskModelArtifact?.enabled) return null;

  const features = extractRiskFeatures(trajectory);
  const scoring = scoreRiskModelArtifact(riskModelArtifact, features);
  const baseProbabilities = scoring.baseProbabilities;
  const ranked = scoring.ranked;
  const conservatism = computeConservatism(features, ranked);
  const probabilities = blendWithUniform(baseProbabilities, conservatism);
  const boundarySoftening = computeBoundarySoftening(features);
  const finalProbabilities = blendWithUniform(probabilities, boundarySoftening);
  const primary = scoring.primary;
  const primaryIndex = riskModelArtifact.classNames.indexOf(primary.className);
  const primaryProbability = finalProbabilities[primaryIndex] ?? primary.probability;

  const probabilityByBand = {
    low: finalProbabilities[riskModelArtifact.classNames.indexOf("low")] ?? 0,
    medium: finalProbabilities[riskModelArtifact.classNames.indexOf("medium")] ?? 0,
    high: finalProbabilities[riskModelArtifact.classNames.indexOf("high")] ?? 0,
  };
  const baseProbabilityByBand = scoring.probabilityByBand;

  const riskScore = clamp(
    baseProbabilityByBand.low * 15 + baseProbabilityByBand.medium * 55 + baseProbabilityByBand.high * 90,
    0,
    100,
  );
  const confidenceProbability = Math.min(Math.max(primaryProbability, 0), 1);
  const reviewReasons = buildReviewReasons(features, ranked, confidenceProbability);
  const needsReview = reviewReasons.length > 0;

  return {
    modelVersion: riskModelArtifact.version,
    featureVersion: options?.featureVersion ?? RISK_FEATURE_VERSION,
    generatedAt: options?.generatedAt ?? new Date().toISOString(),
    className: primary.className,
    riskBand: primary.className,
    riskScore: Number(riskScore.toFixed(2)),
    confidence: Number((confidenceProbability * 100).toFixed(2)),
    confidenceScore: Number(confidenceProbability.toFixed(4)),
    needsReview,
    reviewReasons,
    probabilityByBand,
    featureVector: features,
    calibrationMetrics: {
      calibrationTemperature: riskModelArtifact.calibrationTemperature ?? null,
      validationNll: riskModelArtifact.metrics?.validationNll ?? null,
      validationConfidenceEce: riskModelArtifact.metrics?.validationConfidenceEce ?? null,
      trainAccuracy: riskModelArtifact.metrics?.trainAccuracy ?? null,
      testAccuracy: riskModelArtifact.metrics?.testAccuracy ?? null,
    },
    advisoryOnly: true,
  };
}
