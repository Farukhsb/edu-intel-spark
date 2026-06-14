import type { CentroidModel, CrossValidationSummary, FailureReport, LabeledObservation, ConfusionMatrix } from "./liveData.types";

const FEATURE_COUNT = 6;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const mean = (values: number[]) => {
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / Math.max(values.length, 1);
};

const standardDeviation = (values: number[], average: number) => {
  if (values.length < 2) return 1;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.max(Math.sqrt(variance), 1e-6);
};

const softmax = (values: number[]) => {
  const maxValue = Math.max(...values);
  const exponentials = values.map((value) => Math.exp(value - maxValue));
  const denominator = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / denominator);
};

const hashString = (value: string) => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const stableObservationKey = <L extends string>(observation: LabeledObservation<L>) =>
  `${observation.id}|${observation.label}|${observation.features.map((value) => value.toFixed(4)).join("|")}`;

const sortDeterministically = <L extends string>(rows: LabeledObservation<L>[]) =>
  [...rows].sort((left, right) => hashString(stableObservationKey(left)) - hashString(stableObservationKey(right)));

const stratifiedSplit = <L extends string>(
  rows: LabeledObservation<L>[],
  testFraction = 0.2,
  getLabel: (row: LabeledObservation<L>) => L,
) => {
  const grouped = new Map<L, LabeledObservation<L>[]>();
  rows.forEach((row) => {
    const label = getLabel(row);
    const bucket = grouped.get(label) ?? [];
    bucket.push(row);
    grouped.set(label, bucket);
  });

  const train: LabeledObservation<L>[] = [];
  const test: LabeledObservation<L>[] = [];

  grouped.forEach((group) => {
    const sorted = sortDeterministically(group);
    if (sorted.length <= 1) {
      train.push(...sorted);
      return;
    }

    const testCount = Math.max(1, Math.round(sorted.length * testFraction));
    const cappedTestCount = Math.min(sorted.length - 1, testCount);
    test.push(...sorted.slice(0, cappedTestCount));
    train.push(...sorted.slice(cappedTestCount));
  });

  return { train, test };
};

const buildStratifiedFolds = <L extends string>(
  rows: LabeledObservation<L>[],
  foldCount: number,
  getLabel: (row: LabeledObservation<L>) => L,
) => {
  const grouped = new Map<L, LabeledObservation<L>[]>();
  rows.forEach((row) => {
    const label = getLabel(row);
    const bucket = grouped.get(label) ?? [];
    bucket.push(row);
    grouped.set(label, bucket);
  });

  const folds = Array.from({ length: foldCount }, () => [] as LabeledObservation<L>[]);

  grouped.forEach((group) => {
    const sorted = sortDeterministically(group);
    sorted.forEach((row, index) => {
      folds[index % foldCount]?.push(row);
    });
  });

  return folds;
};

const standardizeFeatures = (features: number[], means: number[], stdDevs: number[]) =>
  features.map((value, index) => (value - means[index]!) / stdDevs[index]!);

const trainCentroidModel = <L extends string>(rows: LabeledObservation<L>[], classNames: L[]): CentroidModel<L> => {
  const means = Array.from({ length: FEATURE_COUNT }, (_, featureIndex) =>
    mean(rows.map((row) => row.features[featureIndex]!)),
  );
  const stdDevs = Array.from({ length: FEATURE_COUNT }, (_, featureIndex) =>
    standardDeviation(
      rows.map((row) => row.features[featureIndex]!),
      means[featureIndex]!,
    ),
  );
  const centroids = classNames.map((className) => {
    const classRows = rows.filter((row) => row.label === className);
    if (classRows.length === 0) {
      return Array.from({ length: FEATURE_COUNT }, () => 0);
    }

    return Array.from({ length: FEATURE_COUNT }, (_, featureIndex) =>
      mean(
        classRows.map((row) => standardizeFeatures(row.features, means, stdDevs)[featureIndex]!),
      ),
    );
  });

  return {
    classNames,
    means,
    stdDevs,
    centroids,
    temperature: 1.2,
  };
};

const predictCentroidModel = <L extends string>(model: CentroidModel<L>, features: number[]) => {
  const standardized = standardizeFeatures(features, model.means, model.stdDevs);
  const scores = model.centroids.map((centroid) =>
    -standardized.reduce((sum, value, index) => sum + (value - centroid[index]!) ** 2, 0) / model.temperature,
  );
  const probabilities = softmax(scores);
  let bestIndex = 0;
  probabilities.forEach((value, index) => {
    if (value > probabilities[bestIndex]!) {
      bestIndex = index;
    }
  });

  return {
    label: model.classNames[bestIndex]!,
    probability: probabilities[bestIndex]!,
    probabilities,
  };
};

const getConfidenceFromProbability = (value: number) => clamp(Math.round(value * 100), 50, 99);

const evaluateModel = <L extends string>(
  rows: LabeledObservation<L>[],
  classNames: L[],
  positiveLabel?: L,
): FailureReport => {
  if (rows.length === 0) {
    return {
      holdoutAccuracy: 0,
      crossValidation: { folds: 0, accuracy: 0, foldAccuracies: [] },
      precision: 0,
      recall: 0,
      confusionMatrix: {
        truePositives: 0,
        falsePositives: 0,
        trueNegatives: 0,
        falseNegatives: 0,
      },
    };
  }

  const { train, test } = stratifiedSplit(rows, 0.2, (row) => row.label);
  const holdoutModel = trainCentroidModel(train, classNames);
  const holdoutPredictions = (test.length > 0 ? test : rows).map((row) => ({
    actual: row.label,
    predicted: predictCentroidModel(holdoutModel, row.features).label,
  }));
  const holdoutCorrect = holdoutPredictions.filter((item) => item.actual === item.predicted).length;
  const holdoutAccuracy = holdoutCorrect / holdoutPredictions.length;

  const uniqueLabelCounts = classNames.reduce<Record<string, number>>((accumulator, label) => {
    accumulator[label] = rows.filter((row) => row.label === label).length;
    return accumulator;
  }, {});
  const minLabelCount = Math.min(...Object.values(uniqueLabelCounts));
  const foldCount = minLabelCount >= 2 ? Math.min(5, minLabelCount) : 0;
  const foldAccuracies: number[] = [];

  if (foldCount >= 2) {
    const folds = buildStratifiedFolds(rows, foldCount, (row) => row.label);
    folds.forEach((fold) => {
      const trainingRows = rows.filter((row) => !fold.includes(row));
      const model = trainCentroidModel(trainingRows, classNames);
      const correct = fold.filter((row) => predictCentroidModel(model, row.features).label === row.label).length;
      foldAccuracies.push(correct / fold.length);
    });
  }

  const positive = positiveLabel ?? classNames[classNames.length - 1]!;
  const confusionMatrix: ConfusionMatrix = {
    truePositives: 0,
    falsePositives: 0,
    trueNegatives: 0,
    falseNegatives: 0,
  };

  holdoutPredictions.forEach((item) => {
    const actualPositive = item.actual === positive;
    const predictedPositive = item.predicted === positive;

    if (actualPositive && predictedPositive) confusionMatrix.truePositives += 1;
    else if (!actualPositive && predictedPositive) confusionMatrix.falsePositives += 1;
    else if (!actualPositive && !predictedPositive) confusionMatrix.trueNegatives += 1;
    else confusionMatrix.falseNegatives += 1;
  });

  const precisionDenominator = confusionMatrix.truePositives + confusionMatrix.falsePositives;
  const recallDenominator = confusionMatrix.truePositives + confusionMatrix.falseNegatives;

  return {
    holdoutAccuracy,
    crossValidation: {
      folds: foldCount,
      accuracy:
        foldAccuracies.length > 0
          ? foldAccuracies.reduce((sum, value) => sum + value, 0) / foldAccuracies.length
          : holdoutAccuracy,
      foldAccuracies,
    } satisfies CrossValidationSummary,
    precision: precisionDenominator > 0 ? confusionMatrix.truePositives / precisionDenominator : 0,
    recall: recallDenominator > 0 ? confusionMatrix.truePositives / recallDenominator : 0,
    confusionMatrix,
  };
};

export const __cohortSignalTestHooks = {
  evaluateModel,
  getConfidenceFromProbability,
  trainCentroidModel,
  predictCentroidModel,
};

export { evaluateModel, getConfidenceFromProbability, predictCentroidModel, trainCentroidModel };
