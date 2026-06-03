import type { StudentTrajectory } from "@/lib/studentRisk";

import { riskModelArtifact } from "@/lib/riskModelArtifact";
import type { RiskModelArtifact, RiskModelClassName } from "@/lib/riskModelArtifactTypes";

export type RiskModelPrediction = {
  modelVersion: string;
  className: RiskModelClassName;
  riskBand: RiskModelClassName;
  riskScore: number;
  confidence: number;
  needsReview: boolean;
  reviewReasons: string[];
  probabilityByBand: Record<RiskModelClassName, number>;
  featureVector: Record<string, number>;
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

function softmax(logits: number[]): number[] {
  const maxLogit = Math.max(...logits);
  const expValues = logits.map((value) => Math.exp(value - maxLogit));
  const denominator = expValues.reduce((sum, value) => sum + value, 0) || 1;
  return expValues.map((value) => value / denominator);
}

function applyTemperatureScaling(logits: number[], temperature?: number): number[] {
  const safeTemperature = Number.isFinite(temperature) && (temperature ?? 0) > 0 ? temperature! : 1;
  return logits.map((value) => value / safeTemperature);
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

function normalizeFeatures(artifact: RiskModelArtifact, features: RiskFeatureVector) {
  return artifact.featureNames.map((featureName, index) => {
    const rawValue = features[featureName as RiskFeatureName] ?? 0;
    const meanValue = artifact.featureMeans[index] ?? 0;
    const stdDev = artifact.featureStdDevs[index] || 1;
    return (rawValue - meanValue) / stdDev;
  });
}

export function scoreStudentRisk(trajectory: StudentTrajectory): RiskModelPrediction | null {
  if (!riskModelArtifact?.enabled) return null;

  const features = extractRiskFeatures(trajectory);
  const normalized = normalizeFeatures(riskModelArtifact, features);

  const logits = riskModelArtifact.classNames.map((_, classIndex) => {
    const weights = (riskModelArtifact.weights[classIndex] ?? []) as number[];
    const bias = riskModelArtifact.biases[classIndex] ?? 0;
    return weights.reduce((sum, weight, featureIndex) => sum + weight * (normalized[featureIndex] ?? 0), bias);
  });

  const calibrationTemperature = (riskModelArtifact as RiskModelArtifact).calibrationTemperature;
  const baseProbabilities = softmax(applyTemperatureScaling(logits, calibrationTemperature));
  const ranked = riskModelArtifact.classNames
    .map((className, index) => ({ className, probability: baseProbabilities[index] ?? 0 }))
    .sort((left, right) => right.probability - left.probability);
  const conservatism = computeConservatism(features, ranked);
  const probabilities = blendWithUniform(baseProbabilities, conservatism);
  const boundarySoftening = computeBoundarySoftening(features);
  const finalProbabilities = blendWithUniform(probabilities, boundarySoftening);
  const primary = ranked[0] ?? { className: "low" as const, probability: 1 / 3 };
  const primaryIndex = riskModelArtifact.classNames.indexOf(primary.className);
  const primaryProbability = finalProbabilities[primaryIndex] ?? primary.probability;

  const probabilityByBand = {
    low: finalProbabilities[riskModelArtifact.classNames.indexOf("low")] ?? 0,
    medium: finalProbabilities[riskModelArtifact.classNames.indexOf("medium")] ?? 0,
    high: finalProbabilities[riskModelArtifact.classNames.indexOf("high")] ?? 0,
  };
  const baseProbabilityByBand = {
    low: baseProbabilities[riskModelArtifact.classNames.indexOf("low")] ?? 0,
    medium: baseProbabilities[riskModelArtifact.classNames.indexOf("medium")] ?? 0,
    high: baseProbabilities[riskModelArtifact.classNames.indexOf("high")] ?? 0,
  };

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
    className: primary.className,
    riskBand: primary.className,
    riskScore: Number(riskScore.toFixed(2)),
    confidence: Number((confidenceProbability * 100).toFixed(2)),
    needsReview,
    reviewReasons,
    probabilityByBand,
    featureVector: features,
  };
}
