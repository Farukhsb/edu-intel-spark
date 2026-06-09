import studentMatCsv from "./data/student-mat.csv?raw";
import studentPorCsv from "./data/student-por.csv?raw";

export type CohortSignalRiskBand = "low" | "medium" | "high" | "insufficient";
export type CohortSignalTrend = "improving" | "steady" | "declining";

export interface CohortSignalStudent {
  id: string;
  name: string;
  initials: string;
  module: string;
  latestMark: number | null;
  averageMark: number | null;
  riskBand: CohortSignalRiskBand;
  predictedToFail: boolean;
  failProbability: number;
  trend: CohortSignalTrend;
  riskReasons: string[];
  confidence: number;
  suggestedAction: string;
  interventionLoggedAt: string | null;
  missingSubmission: boolean;
}

const FEATURE_NAMES = [
  "age",
  "Medu",
  "Fedu",
  "traveltime",
  "studytime",
  "failures",
  "famrel",
  "freetime",
  "goout",
  "Dalc",
  "Walc",
  "health",
  "absences",
  "G1",
  "G2",
] as const;

type FeatureName = (typeof FEATURE_NAMES)[number];
type FeatureVector = Record<FeatureName, number>;
type CohortBand = "low" | "medium" | "high";

type RawStudentRow = FeatureVector & {
  school: string;
  module: string;
  sourceModuleCode: "mat" | "por";
  G3: number;
};

type TrainedModel = {
  featureMeans: number[];
  featureStdDevs: number[];
  classNames: CohortBand[];
  centroids: number[][];
  temperature: number;
  accuracy: number;
};

type FailureModel = {
  featureMeans: number[];
  featureStdDevs: number[];
  classNames: Array<"pass" | "fail">;
  centroids: number[][];
  temperature: number;
  accuracy: number;
};

type ConfusionMatrix = {
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
};

type CrossValidationSummary = {
  folds: number;
  accuracy: number;
  foldAccuracies: number[];
};

type FailureModelReport = {
  holdoutAccuracy: number;
  crossValidation: CrossValidationSummary;
  precision: number;
  recall: number;
  confusionMatrix: ConfusionMatrix;
};

type BandModelReport = {
  holdoutAccuracy: number;
  crossValidation: CrossValidationSummary;
};

const NAMES_BY_BAND: Record<CohortBand, string[]> = {
  high: ["Ada Ibrahim", "Ben Carter", "Elena Garcia", "Hugo Martin"],
  medium: ["Chloe Bennett", "Daniel Owens", "Grace Khan", "Kira Zhang"],
  low: ["Faiz Hussain", "Jamal Patel", "Luca Smith", "Mia Roberts"],
};

const REFERENCE_NOW = new Date("2026-06-09T10:00:00.000Z");

const stripQuotes = (value: string) => value.trim().replace(/^"|"$/g, "");

const toNumber = (value: string) => Number(stripQuotes(value));

const parseStudentCsv = (csv: string, moduleName: string, sourceModuleCode: "mat" | "por"): RawStudentRow[] => {
  const lines = csv.trim().split(/\r?\n/);
  const headers = lines[0].split(";").map(stripQuotes);

  return lines.slice(1).map((line) => {
    const values = line.split(";").map(stripQuotes);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]!])) as Record<string, string>;

    return {
      school: row.school,
      module: moduleName,
      sourceModuleCode,
      age: toNumber(row.age),
      Medu: toNumber(row.Medu),
      Fedu: toNumber(row.Fedu),
      traveltime: toNumber(row.traveltime),
      studytime: toNumber(row.studytime),
      failures: toNumber(row.failures),
      famrel: toNumber(row.famrel),
      freetime: toNumber(row.freetime),
      goout: toNumber(row.goout),
      Dalc: toNumber(row.Dalc),
      Walc: toNumber(row.Walc),
      health: toNumber(row.health),
      absences: toNumber(row.absences),
      G1: toNumber(row.G1),
      G2: toNumber(row.G2),
      G3: toNumber(row.G3),
    };
  });
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const mean = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

const toBand = (grade: number): CohortBand => {
  if (grade >= 14) return "low";
  if (grade >= 10) return "medium";
  return "high";
};

const extractFeatures = (row: RawStudentRow): number[] => FEATURE_NAMES.map((name) => row[name]);

const standardize = (values: number[], means: number[], stdDevs: number[]) =>
  values.map((value, index) => (value - means[index]!) / stdDevs[index]!);

const distanceToCentroid = (features: number[], centroid: number[]) =>
  features.reduce((sum, value, index) => sum + (value - centroid[index]!) ** 2, 0);

const labelBand = (row: RawStudentRow): CohortBand => toBand(row.G3);

const labelFailure = (row: RawStudentRow): "pass" | "fail" => (row.G3 < 10 ? "fail" : "pass");

const hashString = (value: string) => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const stableRowKey = (row: RawStudentRow) =>
  [
    row.sourceModuleCode,
    row.school,
    row.age,
    row.Medu,
    row.Fedu,
    row.traveltime,
    row.studytime,
    row.failures,
    row.absences,
    row.G1,
    row.G2,
    row.G3,
  ].join("|");

const sortDeterministically = <T extends RawStudentRow>(rows: T[]) =>
  [...rows].sort((left, right) => hashString(stableRowKey(left)) - hashString(stableRowKey(right)));

const stratifiedSplit = <T extends RawStudentRow, L extends string>(
  rows: T[],
  getLabel: (row: T) => L,
  testFraction = 0.2,
) => {
  const grouped = new Map<L, T[]>();

  rows.forEach((row) => {
    const label = getLabel(row);
    const bucket = grouped.get(label) ?? [];
    bucket.push(row);
    grouped.set(label, bucket);
  });

  const train: T[] = [];
  const test: T[] = [];

  grouped.forEach((group) => {
    const sorted = sortDeterministically(group);
    const testCount = Math.max(1, Math.round(sorted.length * testFraction));
    test.push(...sorted.slice(0, testCount));
    train.push(...sorted.slice(testCount));
  });

  return {
    train,
    test,
  };
};

const buildStratifiedFolds = <T extends RawStudentRow, L extends string>(
  rows: T[],
  getLabel: (row: T) => L,
  foldCount: number,
) => {
  const grouped = new Map<L, T[]>();

  rows.forEach((row) => {
    const label = getLabel(row);
    const bucket = grouped.get(label) ?? [];
    bucket.push(row);
    grouped.set(label, bucket);
  });

  const folds = Array.from({ length: foldCount }, () => [] as T[]);

  grouped.forEach((group) => {
    const sorted = sortDeterministically(group);
    sorted.forEach((row, index) => {
      folds[index % foldCount]?.push(row);
    });
  });

  return folds;
};

const trainModel = (rows: RawStudentRow[]): TrainedModel => {
  const classNames: CohortBand[] = ["low", "medium", "high"];
  const featureMatrix = rows.map(extractFeatures);
  const featureMeans = FEATURE_NAMES.map((_, index) => mean(featureMatrix.map((sample) => sample[index]!)));
  const featureStdDevs = FEATURE_NAMES.map((_, index) =>
    standardDeviation(featureMatrix.map((sample) => sample[index]!), featureMeans[index]!),
  );
  const normalizedRows = rows.map((row) => standardize(extractFeatures(row), featureMeans, featureStdDevs));
  const rowsByBand = new Map<CohortBand, number[][]>(classNames.map((band) => [band, []]));

  rows.forEach((row, index) => {
    rowsByBand.get(toBand(row.G3))!.push(normalizedRows[index]!);
  });

  const centroids = classNames.map((band) => {
    const group = rowsByBand.get(band)!;
    if (group.length === 0) return FEATURE_NAMES.map(() => 0);
    return FEATURE_NAMES.map((_, featureIndex) => mean(group.map((sample) => sample[featureIndex]!)));
  });

  let correct = 0;
  rows.forEach((row, index) => {
    const normalized = normalizedRows[index]!;
    const logits = centroids.map((centroid) => -distanceToCentroid(normalized, centroid) / 8);
    const probabilities = softmax(logits);
    const predictedBand = classNames[probabilities.indexOf(Math.max(...probabilities))]!;
    if (predictedBand === toBand(row.G3)) {
      correct += 1;
    }
  });

  return {
    featureMeans,
    featureStdDevs,
    classNames,
    centroids,
    temperature: 8,
    accuracy: rows.length > 0 ? correct / rows.length : 0,
  };
};

const scoreRow = (row: RawStudentRow, model: TrainedModel) => {
  const normalized = standardize(extractFeatures(row), model.featureMeans, model.featureStdDevs);
  const logits = model.centroids.map((centroid) => -distanceToCentroid(normalized, centroid) / model.temperature);
  const probabilities = softmax(logits);
  const ranked = model.classNames
    .map((band, index) => ({ band, probability: probabilities[index]! }))
    .sort((left, right) => right.probability - left.probability);
  const predictedBand = ranked[0]!.band;
  const confidence = ranked[0]!.probability;

  return {
    predictedBand,
    confidence,
    probabilityByBand: {
      low: probabilities[0]!,
      medium: probabilities[1]!,
      high: probabilities[2]!,
    },
  };
};

const deriveTrend = (row: RawStudentRow): CohortSignalTrend => {
  if (row.G2 > row.G1 + 1) return "improving";
  if (row.G2 < row.G1 - 1) return "declining";
  return "steady";
};

const deriveRiskReasons = (row: RawStudentRow, band: CohortBand) => {
  const reasons: string[] = [];

  if (band === "high") {
    if (row.failures >= 2) reasons.push("Multiple prior failures are recorded");
    if (row.absences >= 10) reasons.push("Attendance is below the cohort norm");
    if (row.studytime <= 2) reasons.push("Study time is limited");
    if (row.G2 <= 8) reasons.push("The latest mark is still below pass range");
    if (deriveTrend(row) === "declining") reasons.push("The mark trend is declining");
  } else if (band === "medium") {
    if (row.studytime <= 2) reasons.push("Study time is modest");
    if (row.absences >= 6) reasons.push("Absences have begun to accumulate");
    if (Math.abs(row.G2 - row.G1) <= 2) reasons.push("Marks are close to the intervention threshold");
    if (row.G2 < 14) reasons.push("There is still room to stabilise performance");
  } else {
    if (row.G2 >= 14) reasons.push("The latest mark is comfortably above pass threshold");
    if (row.studytime >= 3) reasons.push("Study time is consistent");
    if (row.absences < 6) reasons.push("Attendance is reliable");
    if (deriveTrend(row) !== "declining") reasons.push("The mark trend is stable or improving");
  }

  return reasons.slice(0, 3);
};

const deriveSuggestedAction = (band: CohortBand, row: RawStudentRow) => {
  if (band === "high") {
    return "Book a same-day support check-in and agree a catch-up plan before the next deadline.";
  }
  if (band === "medium") {
    return "Send a short nudge with targeted resources and confirm one action for this week.";
  }
  if (row.G2 >= 16) {
    return "Keep the current plan and consider inviting the student to support peers.";
  }
  return "Continue routine monitoring and reinforce the student's current study plan.";
};

const trainFailureModel = (rows: RawStudentRow[]): FailureModel => {
  const classNames: Array<"pass" | "fail"> = ["pass", "fail"];
  const featureMatrix = rows.map(extractFeatures);
  const featureMeans = FEATURE_NAMES.map((_, index) => mean(featureMatrix.map((sample) => sample[index]!)));
  const featureStdDevs = FEATURE_NAMES.map((_, index) =>
    standardDeviation(featureMatrix.map((sample) => sample[index]!), featureMeans[index]!),
  );
  const normalizedRows = rows.map((row) => standardize(extractFeatures(row), featureMeans, featureStdDevs));
  const rowsByClass = new Map<"pass" | "fail", number[][]>(classNames.map((band) => [band, []]));

  rows.forEach((row, index) => {
    const label: "pass" | "fail" = row.G3 < 10 ? "fail" : "pass";
    rowsByClass.get(label)!.push(normalizedRows[index]!);
  });

  const centroids = classNames.map((band) => {
    const group = rowsByClass.get(band)!;
    if (group.length === 0) return FEATURE_NAMES.map(() => 0);
    return FEATURE_NAMES.map((_, featureIndex) => mean(group.map((sample) => sample[featureIndex] as number)));
  });

  let correct = 0;
  rows.forEach((row, index) => {
    const normalized = normalizedRows[index] as number[];
    const logits = centroids.map((centroid) => -distanceToCentroid(normalized, centroid) / 8);
    const probabilities = softmax(logits);
    const predictedClass = classNames[probabilities.indexOf(Math.max(...probabilities))] as "pass" | "fail";
    if (predictedClass === (row.G3 < 10 ? "fail" : "pass")) {
      correct += 1;
    }
  });

  return {
    featureMeans,
    featureStdDevs,
    classNames,
    centroids,
    temperature: 8,
    accuracy: rows.length > 0 ? correct / rows.length : 0,
  };
};

const scoreFailure = (row: RawStudentRow, model: FailureModel) => {
  const normalized = standardize(extractFeatures(row), model.featureMeans, model.featureStdDevs);
  const logits = model.centroids.map((centroid) => -distanceToCentroid(normalized, centroid) / model.temperature);
  const probabilities = softmax(logits);
  const failProbability = resolveCohortSignalFailureProbability(probabilities);

  return {
    predictedToFail: shouldPredictCohortSignalFailure(probabilities),
    failProbability: Math.round(failProbability * 100),
  };
};

const evaluateBandModel = (rows: RawStudentRow[], folds = 5): BandModelReport => {
  const split = stratifiedSplit(rows, labelBand, 0.2);
  const holdoutModel = trainModel(split.train);
  const holdoutScores = split.test.map((row) => scoreRow(row, holdoutModel));
  const holdoutCorrect = split.test.reduce((correct, row, index) => {
    const predictedBand = resolveCohortSignalPredictedBand(holdoutScores[index]?.predictedBand);
    return correct + (predictedBand === labelBand(row) ? 1 : 0);
  }, 0);

  const foldSets = buildStratifiedFolds(rows, labelBand, folds);
  const foldAccuracies = foldSets.map((testRows) => {
    const trainRows = rows.filter((row) => !testRows.includes(row));
    const model = trainModel(trainRows);
    if (testRows.length === 0) return 0;
    const correct = testRows.reduce((count, row) => {
      const predictedBand = scoreRow(row, model).predictedBand;
      return count + (predictedBand === labelBand(row) ? 1 : 0);
    }, 0);
    return correct / testRows.length;
  });

  return {
    holdoutAccuracy: split.test.length > 0 ? holdoutCorrect / split.test.length : 0,
    crossValidation: {
      folds,
      accuracy: foldAccuracies.length > 0 ? mean(foldAccuracies) : 0,
      foldAccuracies,
    },
  };
};

const evaluateFailureModel = (rows: RawStudentRow[], folds = 5): FailureModelReport => {
  const split = stratifiedSplit(rows, labelFailure, 0.2);
  const holdoutModel = trainFailureModel(split.train);
  const holdoutPredictions = split.test.map((row) => scoreFailure(row, holdoutModel));
  const holdoutConfusion = split.test.reduce<ConfusionMatrix>(
    (matrix, row, index) => {
      const actual = labelFailure(row);
      const predicted = holdoutPredictions[index]?.predictedToFail ? "fail" : "pass";

      if (actual === "fail" && predicted === "fail") matrix.truePositives += 1;
      if (actual === "pass" && predicted === "fail") matrix.falsePositives += 1;
      if (actual === "pass" && predicted === "pass") matrix.trueNegatives += 1;
      if (actual === "fail" && predicted === "pass") matrix.falseNegatives += 1;

      return matrix;
    },
    { truePositives: 0, falsePositives: 0, trueNegatives: 0, falseNegatives: 0 },
  );
  const holdoutTotal = split.test.length || 1;
  const holdoutAccuracy =
    (holdoutConfusion.truePositives + holdoutConfusion.trueNegatives) / holdoutTotal;
  const holdoutPrecision = getPrecisionFromConfusionMatrix(holdoutConfusion);
  const holdoutRecall =
    holdoutConfusion.truePositives + holdoutConfusion.falseNegatives > 0
      ? holdoutConfusion.truePositives / (holdoutConfusion.truePositives + holdoutConfusion.falseNegatives)
      : 0;

  const foldSets = buildStratifiedFolds(rows, labelFailure, folds);
  const foldAccuracies = foldSets.map((testRows) => {
    const trainRows = rows.filter((row) => !testRows.includes(row));
    const model = trainFailureModel(trainRows);
    if (testRows.length === 0) return 0;
    const correct = testRows.reduce((count, row) => {
      const predicted = scoreFailure(row, model).predictedToFail ? "fail" : "pass";
      return count + (predicted === labelFailure(row) ? 1 : 0);
    }, 0);
    return correct / testRows.length;
  });

  return {
    holdoutAccuracy,
    crossValidation: {
      folds,
      accuracy: foldAccuracies.length > 0 ? mean(foldAccuracies) : 0,
      foldAccuracies,
    },
    precision: holdoutPrecision,
    recall: holdoutRecall,
    confusionMatrix: holdoutConfusion,
  };
};

export const getPrecisionFromConfusionMatrix = (matrix: ConfusionMatrix) =>
  matrix.truePositives + matrix.falsePositives > 0
    ? matrix.truePositives / (matrix.truePositives + matrix.falsePositives)
    : 0;

export const resolveCohortSignalFailureProbability = (probabilities: number[]) => probabilities[1] ?? 0;

export const shouldPredictCohortSignalFailure = (probabilities: number[]) =>
  resolveCohortSignalFailureProbability(probabilities) >= (probabilities[0] ?? 0);

export const resolveCohortSignalPredictedBand = (predictedBand: CohortBand | undefined) => predictedBand ?? "low";

export const __cohortSignalDemoTestHooks = {
  evaluateFailureModel,
  evaluateBandModel,
  getPrecisionFromConfusionMatrix,
  resolveCohortSignalFailureProbability,
  shouldPredictCohortSignalFailure,
  resolveCohortSignalPredictedBand,
};

export const resolveCohortSignalBandDisplayName = (band: CohortBand, index: number) =>
  NAMES_BY_BAND[band][index] ?? `Student ${index + 1}`;

export const resolveCohortSignalDemoStudentName = (selectedName: string | undefined, index: number) =>
  selectedName ?? `Student ${index + 1}`;

export const resolveCohortSignalDemoStudentInitials = (displayName: string) =>
  displayName
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const shouldFlagCohortSignalMissingSubmission = (row: RawStudentRow) =>
  row.absences >= 12 || row.failures >= 2 || (row.G2 <= 5 && row.G1 <= 8);

const createInterventionTimestamp = (daysAgo = 0) => {
  const timestamp = new Date(REFERENCE_NOW);
  timestamp.setUTCDate(timestamp.getUTCDate() - daysAgo);
  return timestamp.toISOString();
};

const buildNames = (bands: CohortBand[]) => {
  const counters = { low: 0, medium: 0, high: 0 } as Record<CohortBand, number>;

  return bands.map((band) => {
    const index = counters[band];
    counters[band] += 1;
    return resolveCohortSignalBandDisplayName(band, index);
  });
};

const buildDemoStudents = () => {
  const combinedRows = [
    ...parseStudentCsv(studentMatCsv, "Mathematics", "mat"),
    ...parseStudentCsv(studentPorCsv, "Portuguese Language", "por"),
  ];
  const model = trainModel(combinedRows);
  const failureModel = trainFailureModel(combinedRows);
  const bandReport = evaluateBandModel(combinedRows);
  const failureReport = evaluateFailureModel(combinedRows);

  const scoredRows = combinedRows.map((row) => {
    const prediction = scoreRow(row, model);
    const failurePrediction = scoreFailure(row, failureModel);
    const band = prediction.predictedBand;
    const riskReasons = deriveRiskReasons(row, band);
    if (failurePrediction.predictedToFail) {
      riskReasons.unshift("The model predicts this student may fail without support");
    }
    return {
      ...row,
      band,
      confidence: Math.round(prediction.confidence * 100),
      predictedToFail: failurePrediction.predictedToFail,
      failProbability: failurePrediction.failProbability,
      trend: deriveTrend(row),
      riskReasons: riskReasons.slice(0, 3),
      suggestedAction: deriveSuggestedAction(band, row),
    };
  });

  const pick = (band: CohortBand) =>
    scoredRows
      .filter((row) => row.band === band)
      .sort((left, right) => right.failProbability - left.failProbability || right.confidence - left.confidence)
      .slice(0, 4);

  const selectedRows = [...pick("high"), ...pick("medium"), ...pick("low")];
  const selectedBands = selectedRows.map((row) => row.band);
  const selectedNames = buildNames(selectedBands);

  const students: CohortSignalStudent[] = selectedRows.map((row, index) => ({
    id: `${row.sourceModuleCode}-${index + 1}-${row.G1}-${row.G2}`,
    name: resolveCohortSignalDemoStudentName(selectedNames[index], index),
    initials: resolveCohortSignalDemoStudentInitials(resolveCohortSignalDemoStudentName(selectedNames[index], index)),
    module: row.module,
    latestMark: row.G2,
    averageMark: Math.round((row.G1 + row.G2) / 2),
    riskBand: row.band,
    predictedToFail: row.predictedToFail,
    failProbability: row.failProbability,
    trend: row.trend,
    riskReasons: row.riskReasons,
    confidence: row.confidence,
    suggestedAction: row.suggestedAction,
    interventionLoggedAt: index < 4 ? createInterventionTimestamp(index + 1) : null,
    missingSubmission: shouldFlagCohortSignalMissingSubmission(row),
  }));

  students.push({
    id: "insufficient-data-student",
    name: "Noah Gray",
    initials: "NG",
    module: "Mathematics",
    latestMark: null,
    averageMark: null,
    riskBand: "insufficient",
    predictedToFail: false,
    failProbability: 32,
    trend: "steady",
    riskReasons: ["Only partial records are available", "The latest submission did not complete cleanly"],
    confidence: 38,
    suggestedAction: "Wait for the missing records to arrive before escalating the case.",
    interventionLoggedAt: null,
    missingSubmission: true,
  });

  return {
    students,
    model,
    bandReport,
    failureReport,
  };
};

const cohortSignalDemo = buildDemoStudents();

export const COHORT_SIGNAL_REFERENCE_NOW = REFERENCE_NOW;
export const COHORT_SIGNAL_MODEL = cohortSignalDemo.model;
export const COHORT_SIGNAL_MODEL_ACCURACY = Math.round(cohortSignalDemo.model.accuracy * 100);
export const COHORT_SIGNAL_BAND_REPORT = cohortSignalDemo.bandReport;
export const COHORT_SIGNAL_FAILURE_REPORT = cohortSignalDemo.failureReport;
export const DEMO_COHORT_SIGNAL_STUDENTS = cohortSignalDemo.students;
export { createInterventionTimestamp };
