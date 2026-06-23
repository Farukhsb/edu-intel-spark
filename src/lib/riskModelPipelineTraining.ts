import type { RiskModelArtifact, RiskModelClassName } from "@/lib/riskModelArtifactTypes";
import type {
  RiskModelScoringResult,
  RiskModelTrainingDataset,
  RiskModelTrainingExample,
  RiskModelSplit,
} from "@/lib/riskModelPipelineTypes";
import {
  CLASS_NAMES,
  applyTemperatureScaling,
  buildAlignedOutcomeIndex,
  clamp,
  collectFeatureNames,
  computeFeatureStatistics,
  daysBetween,
  extractTrainingFeatures,
  softmax,
  standardizeExample,
  toDateMs,
} from "@/lib/riskModelPipelineShared";

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

function scoreLinearArtifact(artifact: RiskModelArtifact, features: Record<string, number>): RiskModelScoringResult {
  const normalized = artifact.featureNames.map((featureName, index) => {
    const rawValue = features[featureName] ?? 0;
    const meanValue = artifact.featureMeans[index] ?? 0;
    const stdDev = artifact.featureStdDevs[index] || 1;
    return (rawValue - meanValue) / stdDev;
  });
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
