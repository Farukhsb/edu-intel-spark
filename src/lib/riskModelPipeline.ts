import type { RiskModelArtifact, RiskModelClassName } from "./riskModelArtifactTypes";

export type RiskModelFeatureMap = Record<string, number>;

export type RiskModelTrainingExample = {
  id: string;
  studentId: string;
  observedAt: string;
  label: RiskModelClassName;
  features: RiskModelFeatureMap;
  source: "prediction_outcome" | "aligned_outcome";
};

export type RiskModelTrainingDataset = {
  predictions: Array<{
    id: string;
    student_id: string;
    prediction_date: string;
    model_version: string;
    risk_score: number | string;
    risk_band: string;
    details: unknown | null;
  }>;
  outcomes: Array<{
    prediction_id: string | null;
    student_id: string;
    outcome_date: string;
    label_value: string;
    label_window_days: number;
  }>;
};

export type RiskModelScoringResult = {
  logits: number[];
  baseProbabilities: number[];
  probabilities: number[];
  ranked: Array<{ className: RiskModelClassName; probability: number }>;
  primary: { className: RiskModelClassName; probability: number };
  probabilityByBand: Record<RiskModelClassName, number>;
};

type RiskModelSplit = {
  train: RiskModelTrainingExample[];
  validation: RiskModelTrainingExample[];
};

const DEFAULT_FEATURE_ORDER = [
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

const CLASS_NAMES: RiskModelClassName[] = ["low", "medium", "high"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function toDateMs(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function daysBetween(olderDate: string | null | undefined, newerDate: string | null | undefined) {
  const older = toDateMs(olderDate);
  const newer = toDateMs(newerDate);
  if (older == null || newer == null) return null;
  return Math.max(0, Math.floor((newer - older) / (1000 * 60 * 60 * 24)));
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[], average: number) {
  if (values.length < 2) return 1;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.max(Math.sqrt(variance), 1e-6);
}

function softmax(logits: number[]) {
  const maxLogit = Math.max(...logits);
  const expValues = logits.map((value) => Math.exp(value - maxLogit));
  const denominator = expValues.reduce((sum, value) => sum + value, 0) || 1;
  return expValues.map((value) => value / denominator);
}

function applyTemperatureScaling(logits: number[], temperature?: number) {
  const safeTemperature = Number.isFinite(temperature) && (temperature ?? 0) > 0 ? temperature! : 1;
  return logits.map((value) => value / safeTemperature);
}

function normalizeFeatures(artifact: RiskModelArtifact, features: RiskModelFeatureMap) {
  return artifact.featureNames.map((featureName, index) => {
    const rawValue = features[featureName] ?? 0;
    const meanValue = artifact.featureMeans[index] ?? 0;
    const stdDev = artifact.featureStdDevs[index] || 1;
    return (rawValue - meanValue) / stdDev;
  });
}

function extractObjectFeatureMap(value: unknown): RiskModelFeatureMap | null {
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

function extractTrainingFeatures(prediction: RiskModelTrainingDataset["predictions"][number]) {
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

function buildAlignedOutcomeIndex(dataset: RiskModelTrainingDataset) {
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

export function buildRiskModelTrainingExamples(dataset: RiskModelTrainingDataset): RiskModelTrainingExample[] {
  const { byPredictionId, byStudentId } = buildAlignedOutcomeIndex(dataset);
  const examples: RiskModelTrainingExample[] = [];
  const consumedPredictionIds = new Set<string>();

  for (const prediction of dataset.predictions) {
    const directOutcome = byPredictionId.get(prediction.id);
    const alignedOutcome = directOutcome ?? byStudentId.get(prediction.student_id)?.find((outcome) => {
      const predictionTime = toDateMs(prediction.prediction_date);
      const outcomeTime = toDateMs(outcome.outcome_date);
      if (predictionTime == null || outcomeTime == null || outcomeTime < predictionTime) return false;
      const daysUntilOutcome = daysBetween(prediction.prediction_date, outcome.outcome_date);
      return daysUntilOutcome != null && daysUntilOutcome <= outcome.label_window_days;
    }) ?? null;

    if (!alignedOutcome || consumedPredictionIds.has(prediction.id)) continue;
    if (!CLASS_NAMES.includes(alignedOutcome.label_value as RiskModelClassName)) continue;

    const features = extractTrainingFeatures(prediction);
    examples.push({
      id: prediction.id,
      studentId: prediction.student_id,
      observedAt: alignedOutcome.outcome_date,
      label: alignedOutcome.label_value as RiskModelClassName,
      features,
      source: directOutcome ? "prediction_outcome" : "aligned_outcome",
    });
    consumedPredictionIds.add(prediction.id);
  }

  return examples;
}

function splitExamples(examples: RiskModelTrainingExample[]): RiskModelSplit {
  if (examples.length <= 2) {
    return {
      train: examples.slice(0, Math.max(1, examples.length - 1)),
      validation: examples.slice(Math.max(1, examples.length - 1)),
    };
  }

  const ordered = [...examples].sort((left, right) => toDateMs(left.observedAt)! - toDateMs(right.observedAt)!);
  const validationSize = clamp(Math.round(ordered.length * 0.2), 1, ordered.length - 1);
  return {
    train: ordered.slice(0, ordered.length - validationSize),
    validation: ordered.slice(ordered.length - validationSize),
  };
}

function collectFeatureNames(examples: RiskModelTrainingExample[]) {
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

function computeFeatureStatistics(examples: RiskModelTrainingExample[], featureNames: string[]) {
  const valuesByFeature = featureNames.map((featureName) => examples.map((example) => example.features[featureName] ?? 0));
  const means = valuesByFeature.map((values) => mean(values));
  const stdDevs = valuesByFeature.map((values, index) => standardDeviation(values, means[index] ?? 0));
  return { means, stdDevs };
}

function standardizeExample(features: RiskModelFeatureMap, featureNames: string[], means: number[], stdDevs: number[]) {
  return featureNames.map((featureName, index) => {
    const rawValue = features[featureName] ?? 0;
    const meanValue = means[index] ?? 0;
    const stdDev = stdDevs[index] || 1;
    return (rawValue - meanValue) / stdDev;
  });
}

function scoreLinearArtifact(artifact: RiskModelArtifact, features: RiskModelFeatureMap): RiskModelScoringResult {
  const normalized = normalizeFeatures(artifact, features);
  const logits = artifact.classNames.map((_, classIndex) => {
    const weights = (artifact.weights[classIndex] ?? []) as number[];
    const bias = artifact.biases[classIndex] ?? 0;
    return weights.reduce((sum, weight, featureIndex) => sum + weight * (normalized[featureIndex] ?? 0), bias);
  });

  const baseProbabilities = softmax(applyTemperatureScaling(logits, artifact.calibrationTemperature));
  const ranked = artifact.classNames
    .map((className, index) => ({ className, probability: baseProbabilities[index] ?? 0 }))
    .sort((left, right) => right.probability - left.probability);

  return {
    logits,
    baseProbabilities,
    probabilities: baseProbabilities,
    ranked,
    primary: ranked[0] ?? { className: "low", probability: 1 / 3 },
    probabilityByBand: {
      low: baseProbabilities[artifact.classNames.indexOf("low")] ?? 0,
      medium: baseProbabilities[artifact.classNames.indexOf("medium")] ?? 0,
      high: baseProbabilities[artifact.classNames.indexOf("high")] ?? 0,
    },
  };
}

function buildArtifactFromCentroids(
  featureNames: string[],
  means: number[],
  stdDevs: number[],
  examples: RiskModelTrainingExample[],
  calibrationTemperature: number,
): RiskModelArtifact {
  const classCounts = new Map<RiskModelClassName, number>(CLASS_NAMES.map((className) => [className, 0]));
  const centroidSums = new Map<RiskModelClassName, number[]>(CLASS_NAMES.map((className) => [className, featureNames.map(() => 0)]));

  for (const example of examples) {
    const normalized = standardizeExample(example.features, featureNames, means, stdDevs);
    classCounts.set(example.label, (classCounts.get(example.label) ?? 0) + 1);
    const current = centroidSums.get(example.label) ?? featureNames.map(() => 0);
    centroidSums.set(
      example.label,
      current.map((value, index) => value + (normalized[index] ?? 0)),
    );
  }

  const total = examples.length;
  const weights = CLASS_NAMES.map((className) => {
    const count = classCounts.get(className) ?? 0;
    if (count === 0) return featureNames.map(() => 0);
    return (centroidSums.get(className) ?? featureNames.map(() => 0)).map((value) => value / count);
  });

  const biases = CLASS_NAMES.map((className, classIndex) => {
    const count = classCounts.get(className) ?? 0;
    const prior = (count + 1) / (total + CLASS_NAMES.length);
    const weightVector = weights[classIndex] ?? [];
    const penalty = weightVector.reduce((sum, value) => sum + value ** 2, 0) / 2;
    return Math.log(prior) - penalty;
  });

  return {
    enabled: true,
    version: "historical-outcomes-v1",
    trainedAt: new Date().toISOString(),
    calibrationTemperature,
    featureNames,
    classNames: CLASS_NAMES,
    featureMeans: means,
    featureStdDevs: stdDevs,
    weights,
    biases,
    metrics: {
      trainAccuracy: 0,
      testAccuracy: 0,
      trainingExamples: examples.length,
      testExamples: 0,
      source: "historical_outcomes",
      calibrationTemperature,
      validationConfidenceEce: 0,
    },
  };
}

function evaluateArtifact(artifact: RiskModelArtifact, examples: RiskModelTrainingExample[]) {
  if (examples.length === 0) {
    return {
      accuracy: 0,
      nll: 0,
      ece: 0,
    };
  }

  const bins = Array.from({ length: 10 }, () => ({ total: 0, correct: 0, confidenceSum: 0 }));
  let correct = 0;
  let nll = 0;

  for (const example of examples) {
    const scoring = scoreLinearArtifact(artifact, example.features);
    const predicted = scoring.primary.className;
    if (predicted === example.label) {
      correct += 1;
    }

    const trueIndex = artifact.classNames.indexOf(example.label);
    const trueProbability = scoring.baseProbabilities[trueIndex] ?? 1e-12;
    nll += -Math.log(Math.max(trueProbability, 1e-12));

    const maxProbability = scoring.primary.probability;
    const binIndex = Math.min(9, Math.floor(maxProbability * 10));
    const bin = bins[binIndex];
    bin.total += 1;
    bin.correct += predicted === example.label ? 1 : 0;
    bin.confidenceSum += maxProbability;
  }

  const ece = bins.reduce((sum, bin) => {
    if (bin.total === 0) return sum;
    const accuracy = bin.correct / bin.total;
    const confidence = bin.confidenceSum / bin.total;
    return sum + (bin.total / examples.length) * Math.abs(accuracy - confidence);
  }, 0);

  return {
    accuracy: correct / examples.length,
    nll: nll / examples.length,
    ece,
  };
}

function optimizeTemperature(artifact: RiskModelArtifact, validation: RiskModelTrainingExample[]) {
  const candidates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  if (validation.length === 0) return artifact.calibrationTemperature ?? 1;

  let bestTemperature = artifact.calibrationTemperature ?? 1;
  let bestNll = Number.POSITIVE_INFINITY;

  for (const temperature of candidates) {
    const candidate = {
      ...artifact,
      calibrationTemperature: temperature,
    };
    const evaluation = evaluateArtifact(candidate, validation);
    if (evaluation.nll < bestNll) {
      bestNll = evaluation.nll;
      bestTemperature = temperature;
    }
  }

  return bestTemperature;
}

export function scoreRiskModelArtifact(artifact: RiskModelArtifact, features: RiskModelFeatureMap) {
  return scoreLinearArtifact(artifact, features);
}

export function trainRiskModelArtifact(examples: RiskModelTrainingExample[]): RiskModelArtifact | null {
  if (examples.length === 0) return null;

  const { train, validation } = splitExamples(examples);
  const featureNames = collectFeatureNames(train.length > 0 ? train : examples);
  if (featureNames.length === 0) return null;

  const { means, stdDevs } = computeFeatureStatistics(train.length > 0 ? train : examples, featureNames);
  const provisionalArtifact = buildArtifactFromCentroids(featureNames, means, stdDevs, train.length > 0 ? train : examples, 1);
  const calibrationTemperature = optimizeTemperature(provisionalArtifact, validation);
  const artifact = buildArtifactFromCentroids(featureNames, means, stdDevs, train.length > 0 ? train : examples, calibrationTemperature);

  const trainEvaluation = evaluateArtifact(artifact, train.length > 0 ? train : examples);
  const validationEvaluation = evaluateArtifact(artifact, validation);

  return {
    ...artifact,
    trainedAt: examples
      .map((example) => example.observedAt)
      .sort()
      .at(-1) ?? artifact.trainedAt,
    metrics: {
      trainAccuracy: Number(trainEvaluation.accuracy.toFixed(4)),
      testAccuracy: Number(validationEvaluation.accuracy.toFixed(4)),
      trainingExamples: train.length > 0 ? train.length : examples.length,
      testExamples: validation.length,
      source: "historical_outcomes",
      calibrationTemperature,
      validationNll: Number(validationEvaluation.nll.toFixed(4)),
      validationConfidenceEce: Number(validationEvaluation.ece.toFixed(4)),
    },
  };
}

export function summarizeRiskModelTrainingExamples(examples: RiskModelTrainingExample[]) {
  const byLabel = new Map<RiskModelClassName, number>(CLASS_NAMES.map((className) => [className, 0]));
  for (const example of examples) {
    byLabel.set(example.label, (byLabel.get(example.label) ?? 0) + 1);
  }

  return {
    total: examples.length,
    low: byLabel.get("low") ?? 0,
    medium: byLabel.get("medium") ?? 0,
    high: byLabel.get("high") ?? 0,
    featureCount: collectFeatureNames(examples).length,
  };
}
