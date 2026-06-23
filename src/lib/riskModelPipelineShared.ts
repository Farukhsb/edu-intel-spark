import type { RiskModelArtifact, RiskModelClassName } from "@/lib/riskModelArtifactTypes";
import type { RiskModelFeatureMap, RiskModelTrainingDataset, RiskModelTrainingExample } from "@/lib/riskModelPipelineTypes";

export const DEFAULT_FEATURE_ORDER = [
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

export const CLASS_NAMES: RiskModelClassName[] = ["low", "medium", "high"];

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

export function toDateMs(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function daysBetween(olderDate: string | null | undefined, newerDate: string | null | undefined) {
  const older = toDateMs(olderDate);
  const newer = toDateMs(newerDate);
  if (older == null || newer == null) return null;
  return Math.max(0, Math.floor((newer - older) / (1000 * 60 * 60 * 24)));
}

export function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function standardDeviation(values: number[], average: number) {
  if (values.length < 2) return 1;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.max(Math.sqrt(variance), 1e-6);
}

export function softmax(logits: number[]) {
  const maxLogit = Math.max(...logits);
  const expValues = logits.map((value) => Math.exp(value - maxLogit));
  const denominator = expValues.reduce((sum, value) => sum + value, 0) || 1;
  return expValues.map((value) => value / denominator);
}

export function applyTemperatureScaling(logits: number[], temperature?: number) {
  const safeTemperature = Number.isFinite(temperature) && (temperature ?? 0) > 0 ? temperature! : 1;
  return logits.map((value) => value / safeTemperature);
}

export function normalizeFeatures(artifact: RiskModelArtifact, features: RiskModelFeatureMap) {
  return artifact.featureNames.map((featureName, index) => {
    const rawValue = features[featureName] ?? 0;
    const meanValue = artifact.featureMeans[index] ?? 0;
    const stdDev = artifact.featureStdDevs[index] || 1;
    return (rawValue - meanValue) / stdDev;
  });
}

export function extractObjectFeatureMap(value: unknown): RiskModelFeatureMap | null {
  if (!isRecord(value)) return null;

  const featureMap: RiskModelFeatureMap = {};
  for (const [key, entry] of Object.entries(value)) {
    const numeric = toNumber(entry, Number.NaN);
    if (Number.isFinite(numeric)) {
      featureMap[key] = numeric;
    }
  }

  return Object.keys(featureMap).length > 0 ? featureMap : null;
}

export function extractTrainingFeatures(prediction: RiskModelTrainingDataset["predictions"][number]) {
  const details = isRecord(prediction.details) ? prediction.details : {};
  const featureVector =
    extractObjectFeatureMap(details.model_feature_vector) ||
    extractObjectFeatureMap(details.modelFeatureVector) ||
    extractObjectFeatureMap(details.feature_vector) ||
    extractObjectFeatureMap(details.featureVector);

  if (featureVector) {
    return featureVector;
  }

  const compositeScores = extractObjectFeatureMap(details.composite_component_scores) || extractObjectFeatureMap(details.compositeComponentScores);
  const probabilityByBand =
    extractObjectFeatureMap(details.model_probability_by_band) || extractObjectFeatureMap(details.modelProbabilityByBand);

  return {
    scoreCount: toNumber(details.score_count ?? details.scoreCount, 0),
    average: toNumber(details.avg_grade ?? details.average, 0),
    last: toNumber(details.last_grade ?? details.last, 0),
    minimum: toNumber(details.minimum, 0),
    maximum: toNumber(details.maximum, 0),
    slope: toNumber(details.trend_slope ?? details.slope, 0),
    predictedNext: toNumber(details.predicted_next ?? details.predictedNext, 0),
    stdDev: toNumber(details.std_dev ?? details.stdDev, 0),
    recent3Avg: toNumber(details.recent_3_avg ?? details.recent3Avg, 0),
    earlyAvg: toNumber(details.early_avg ?? details.earlyAvg, 0),
    firstLastDelta: toNumber(details.first_last_delta ?? details.firstLastDelta, 0),
    recentDelta: toNumber(details.recent_delta ?? details.recentDelta, 0),
    below50Ratio: toNumber(details.below50_ratio ?? details.below50Ratio, 0),
    below40Ratio: toNumber(details.below40_ratio ?? details.below40Ratio, 0),
    academic_risk_score: toNumber(details.academic_risk_score ?? details.academicRiskScore, toNumber(prediction.risk_score, 0)),
    engagement_event_count: toNumber(details.engagement_event_count ?? details.engagementEventCount, 0),
    engagement_last_event_age_days: toNumber(details.engagement_last_event_age_days ?? details.engagementLastEventAgeDays, 0),
    non_submission_total_assignments: toNumber(details.non_submission_total_assignments ?? details.nonSubmissionTotalAssignments, 0),
    non_submission_submitted_assignments: toNumber(details.non_submission_submitted_assignments ?? details.nonSubmissionSubmittedAssignments, 0),
    non_submission_late_submissions: toNumber(details.non_submission_late_submissions ?? details.nonSubmissionLateSubmissions, 0),
    composite_academic: toNumber(compositeScores?.academic, 0),
    composite_engagement: toNumber(compositeScores?.engagement, 0),
    composite_nonSubmission: toNumber(compositeScores?.nonSubmission, 0),
    model_confidence: toNumber(details.model_confidence ?? details.modelConfidence, 0),
    model_risk_score: toNumber(details.model_risk_score ?? details.modelRiskScore, toNumber(prediction.risk_score, 0)),
    model_probability_low: toNumber(probabilityByBand?.low, 0),
    model_probability_medium: toNumber(probabilityByBand?.medium, 0),
    model_probability_high: toNumber(probabilityByBand?.high, 0),
  };
}

export function buildAlignedOutcomeIndex(dataset: RiskModelTrainingDataset) {
  const byPredictionId = new Map<string, (typeof dataset.outcomes)[number]>();
  const byStudentId = new Map<string, (typeof dataset.outcomes)[number][]>();

  for (const outcome of dataset.outcomes) {
    if (outcome.prediction_id) {
      byPredictionId.set(outcome.prediction_id, outcome);
    }

    const current = byStudentId.get(outcome.student_id) ?? [];
    current.push(outcome);
    byStudentId.set(outcome.student_id, current);
  }

  for (const outcomes of byStudentId.values()) {
    outcomes.sort((left, right) => (toDateMs(left.outcome_date) ?? 0) - (toDateMs(right.outcome_date) ?? 0));
  }

  return { byPredictionId, byStudentId };
}

export function collectFeatureNames(examples: RiskModelTrainingExample[]) {
  const ordered = new Set<string>();

  for (const featureName of DEFAULT_FEATURE_ORDER) {
    if (examples.some((example) => featureName in example.features)) {
      ordered.add(featureName);
    }
  }

  for (const example of examples) {
    for (const featureName of Object.keys(example.features)) {
      ordered.add(featureName);
    }
  }

  return Array.from(ordered);
}

export function computeFeatureStatistics(examples: RiskModelTrainingExample[], featureNames: string[]) {
  const valuesByFeature = featureNames.map((featureName) => examples.map((example) => example.features[featureName] ?? 0));
  const means = valuesByFeature.map((values) => mean(values));
  const stdDevs = valuesByFeature.map((values, index) => standardDeviation(values, means[index] ?? 0));
  return { means, stdDevs };
}

export function standardizeExample(features: RiskModelFeatureMap, featureNames: string[], means: number[], stdDevs: number[]) {
  return featureNames.map((featureName, index) => {
    const rawValue = features[featureName] ?? 0;
    const meanValue = means[index] ?? 0;
    const stdDev = stdDevs[index] || 1;
    return (rawValue - meanValue) / stdDev;
  });
}
