import { evaluateStudentRisk, type StudentTrajectory } from "@/lib/studentRisk";
import type { CohortSignalRiskBand, CohortSignalStudent } from "@/pages/cohortsignal-demo/demoData";
import type { StudentInterventionRow } from "@/lib/interventions";

type AssignmentRow = {
  id: string;
  title: string;
  module_code: string | null;
};

type SubmissionRow = {
  id: string;
  assignment_id: string;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  status: string;
  submitted_at: string;
};

type GradeRow = {
  submission_id: string;
  ai_score: number | null;
  final_score: number | null;
};

type LabeledObservation<L extends string> = {
  id: string;
  features: number[];
  label: L;
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

export type BandReport = {
  holdoutAccuracy: number;
  crossValidation: CrossValidationSummary;
};

export type FailureReport = {
  holdoutAccuracy: number;
  crossValidation: CrossValidationSummary;
  precision: number;
  recall: number;
  confusionMatrix: ConfusionMatrix;
};

export type LiveCohortSignalDataset = {
  students: CohortSignalStudent[];
  bandReport: BandReport;
  failureReport: FailureReport;
};

type CentroidModel<L extends string> = {
  classNames: L[];
  means: number[];
  stdDevs: number[];
  centroids: number[][];
  temperature: number;
};

const FEATURE_COUNT = 6;
const LIVE_REFERENCE_NOW = new Date().toISOString();

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
  const denominator = exponentials.reduce((sum, value) => sum + value, 0) || 1;
  return exponentials.map((value) => value / denominator);
};

const hashString = (value: string) => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index) ?? 0;
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
  features.map((value, index) => (value - (means[index] ?? 0)) / (stdDevs[index] ?? 1));

const trainCentroidModel = <L extends string>(
  rows: LabeledObservation<L>[],
  classNames: L[],
): CentroidModel<L> => {
  const means = Array.from({ length: FEATURE_COUNT }, (_, featureIndex) =>
    mean(rows.map((row) => row.features[featureIndex] ?? 0)),
  );
  const stdDevs = Array.from({ length: FEATURE_COUNT }, (_, featureIndex) =>
    standardDeviation(
      rows.map((row) => row.features[featureIndex] ?? 0),
      means[featureIndex] ?? 0,
    ),
  );
  const centroids = classNames.map((className) => {
    const classRows = rows.filter((row) => row.label === className);
    if (classRows.length === 0) {
      return Array.from({ length: FEATURE_COUNT }, () => 0);
    }

    return Array.from({ length: FEATURE_COUNT }, (_, featureIndex) =>
      mean(
        classRows.map(
          (row) => standardizeFeatures(row.features, means, stdDevs)[featureIndex] ?? 0,
        ),
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
    -standardized.reduce((sum, value, index) => sum + (value - (centroid[index] ?? 0)) ** 2, 0) / model.temperature,
  );
  const probabilities = softmax(scores);
  let bestIndex = 0;
  probabilities.forEach((value, index) => {
    if (value > probabilities[bestIndex]!) {
      bestIndex = index;
    }
  });

  return {
    label: model.classNames[bestIndex],
    probability: probabilities[bestIndex] ?? 0,
    probabilities,
  };
};

const getConfidenceFromProbability = (value: number) => clamp(Math.round(value * 100), 50, 99);

const evaluateModel = <L extends string>(
  rows: LabeledObservation<L>[],
  classNames: L[],
  positiveLabel?: L,
) => {
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
  const holdoutModel = trainCentroidModel(train.length > 0 ? train : rows, classNames);
  const holdoutPredictions = (test.length > 0 ? test : rows).map((row) => ({
    actual: row.label,
    predicted: predictCentroidModel(holdoutModel, row.features).label,
  }));
  const holdoutCorrect = holdoutPredictions.filter((item) => item.actual === item.predicted).length;
  const holdoutAccuracy = holdoutPredictions.length > 0 ? holdoutCorrect / holdoutPredictions.length : 0;

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
      const model = trainCentroidModel(trainingRows.length > 0 ? trainingRows : rows, classNames);
      const correct = fold.filter((row) => predictCentroidModel(model, row.features).label === row.label).length;
      foldAccuracies.push(fold.length > 0 ? correct / fold.length : 0);
    });
  }

  const positive = positiveLabel ?? classNames[classNames.length - 1] ?? classNames[0];
  const confusionMatrix = {
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
    },
    precision: precisionDenominator > 0 ? confusionMatrix.truePositives / precisionDenominator : 0,
    recall: recallDenominator > 0 ? confusionMatrix.truePositives / recallDenominator : 0,
    confusionMatrix,
  };
};

const getTrend = (slope: number) => {
  if (slope > 1) return "improving";
  if (slope < -1) return "declining";
  return "steady";
};

const getSlope = (values: number[]) => {
  const n = values.length;
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i += 1) {
    sumX += i;
    sumY += values[i] ?? 0;
    sumXY += i * (values[i] ?? 0);
    sumXX += i * i;
  }

  const denominator = n * sumXX - sumX * sumX;
  return denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
};

const riskReasonLabelByCode: Record<string, string> = {
  average_below_40: "Average below 40%",
  average_below_50: "Average below 50%",
  steep_grade_decline: "Steep grade decline",
  gradual_grade_decline: "Gradual grade decline",
  recent_grade_drop: "Recent grade drop",
  predicted_next_below_40: "Expected next outcome below 40%",
  high_variance: "Highly inconsistent grades",
  limited_history: "Only 1 submission graded",
  stale_data: "Latest evidence is stale",
  baseline_monitoring: "Baseline monitoring",
};

export const buildLiveCohortSignalDataset = ({
  assignments,
  submissions,
  grades,
  interventions,
}: {
  assignments: AssignmentRow[];
  submissions: SubmissionRow[];
  grades: GradeRow[];
  interventions: StudentInterventionRow[];
}): LiveCohortSignalDataset => {
  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const gradeBySubmission = new Map(
    grades
      .map((grade) => [grade.submission_id, grade.final_score ?? grade.ai_score] as const)
      .filter(([, score]) => score != null),
  );
  const interventionByStudent = new Map<string, StudentInterventionRow>();
  interventions.forEach((intervention) => {
    const key = intervention.student_id;
    if (!key) return;

    const current = interventionByStudent.get(key);
    if (!current || new Date(intervention.created_at ?? intervention.updated_at ?? "").getTime() > new Date(current.created_at ?? current.updated_at ?? "").getTime()) {
      interventionByStudent.set(key, intervention);
    }
  });

  const studentTrajectories = new Map<
    string,
    {
      studentId: string;
      name: string;
      email: string | null;
      module: string;
      scores: Array<{ score: number; date: string; assignmentTitle: string }>;
    }
  >();

  submissions.forEach((submission) => {
    const score = gradeBySubmission.get(submission.id);
    if (score == null) return;

    const key = submission.student_id || submission.student_email || submission.student_name || submission.id;
    const assignment = assignmentById.get(submission.assignment_id);
    const current =
      studentTrajectories.get(key) ?? {
        studentId: submission.student_id || key,
        name: submission.student_name || submission.student_email || "Student",
        email: submission.student_email || null,
        module: assignment?.module_code || assignment?.title || "General",
        scores: [],
      };

    current.module = assignment?.module_code || assignment?.title || current.module;
    current.scores.push({
      score,
      date: submission.submitted_at,
      assignmentTitle: assignment?.title || "Assignment",
    });
    studentTrajectories.set(key, current);
  });

  const observations: Array<
    LabeledObservation<"low" | "medium" | "high"> & {
      trajectory: StudentTrajectory;
      module: string;
      interventionLoggedAt: string | null;
      missingSubmission: boolean;
      averageMark: number;
      latestMark: number;
      trend: "improving" | "steady" | "declining";
      riskReasons: string[];
      suggestedAction: string;
      predictedNext: number;
      failProbability: number;
    }
  > = [];

  const bandObservations: LabeledObservation<"low" | "medium" | "high">[] = [];
  const failureObservations: LabeledObservation<"pass" | "fail">[] = [];

  const totalAssignments = assignments.length;

  studentTrajectories.forEach((trajectoryRecord, studentKey) => {
    const orderedScores = [...trajectoryRecord.scores].sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
    const scores = orderedScores.map((entry) => entry.score);
    if (scores.length === 0) return;

    const averageMark = mean(scores);
    const latestMark = scores[scores.length - 1] ?? averageMark;
    const slope = getSlope(scores);
    const trend = getTrend(slope);
    const variance =
      scores.length >= 2 ? mean(scores.map((score) => (score - averageMark) ** 2)) : 0;
    const missingSubmission = totalAssignments > 0 && scores.length < totalAssignments;
    const intervention = interventionByStudent.get(trajectoryRecord.studentId) ?? interventionByStudent.get(studentKey);
    const interventionLoggedAt = intervention?.created_at ?? intervention?.updated_at ?? null;

    const trajectory: StudentTrajectory = {
      studentId: trajectoryRecord.studentId,
      name: trajectoryRecord.name,
      email: trajectoryRecord.email,
      scores: orderedScores.map((entry) => ({
        score: entry.score,
        date: entry.date,
        assignmentTitle: entry.assignmentTitle,
      })),
    };

    const evaluation = evaluateStudentRisk(trajectory, { referenceDate: LIVE_REFERENCE_NOW, staleWindowDays: 30 });
    const reasons = evaluation?.reasonCodes ?? ["baseline_monitoring"];
    const suggestedAction = `${evaluation?.recommendation ?? "Schedule a check-in to review study strategies and agree short-term goals."}${interventionLoggedAt ? " Follow up on the logged intervention and confirm the next step." : ""}`;

    const featureVector = [
      averageMark,
      latestMark,
      slope,
      variance,
      scores.length,
      missingSubmission ? 1 : 0,
    ];

    observations.push({
      id: trajectory.studentId,
      label: averageMark >= 65 ? "low" : averageMark >= 50 ? "medium" : "high",
      features: featureVector,
      trajectory,
      module: trajectoryRecord.module,
      interventionLoggedAt,
      missingSubmission,
      averageMark,
      latestMark,
      trend,
      riskReasons: reasons.map((reason) => riskReasonLabelByCode[reason] ?? reason),
      suggestedAction,
      predictedNext: evaluation?.predictedNext ?? Math.round(averageMark),
      failProbability: 0,
    });
  });

  const bandObservationsById = observations.map(({ id, features, label }) => ({
    id,
    features,
    label,
  }));
  const failureObservationsById = observations.map(({ id, features, averageMark }) => ({
    id,
    features,
    label: (averageMark < 50 ? "fail" : "pass") as "pass" | "fail",
  }));

  const bandModel = trainCentroidModel(bandObservationsById, ["low", "medium", "high"]);
  const failureModel = trainCentroidModel(failureObservationsById, ["pass", "fail"]);
  const bandReport = evaluateModel(bandObservationsById, ["low", "medium", "high"]);
  const failureReport = evaluateModel(failureObservationsById, ["pass", "fail"], "fail");

  const students = observations.map((observation) => {
    const bandPrediction = predictCentroidModel(bandModel, observation.features);
    const failurePrediction = predictCentroidModel(failureModel, observation.features);
    const bandLabel = (observation.trajectory.scores.length < 2 ? "insufficient" : bandPrediction.label) as CohortSignalRiskBand;
    const failProbability = Math.round((failurePrediction.probabilities[1] ?? 0) * 100);
    const confidence = getConfidenceFromProbability(Math.max(bandPrediction.probability, failurePrediction.probability));

    const riskReasons = [...observation.riskReasons];
    if (observation.missingSubmission) {
      riskReasons.push("Missing one or more submissions");
    }
    if (observation.interventionLoggedAt) {
      riskReasons.push("Intervention already logged");
    }

    return {
      id: observation.id,
      name: observation.trajectory.name,
      initials: observation.trajectory.name
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
        .slice(0, 2),
      module: observation.module,
      latestMark: Math.round(observation.latestMark),
      averageMark: Math.round(observation.averageMark),
      riskBand: bandLabel,
      predictedToFail: failurePrediction.label === "fail",
      failProbability,
      trend: observation.trend,
      riskReasons,
      confidence,
      suggestedAction: observation.suggestedAction,
      interventionLoggedAt: observation.interventionLoggedAt,
      missingSubmission: observation.missingSubmission,
    } satisfies CohortSignalStudent;
  });

  students.sort((left, right) => {
    const leftPriority = left.predictedToFail ? 0 : left.riskBand === "high" ? 1 : left.riskBand === "medium" ? 2 : 3;
    const rightPriority = right.predictedToFail ? 0 : right.riskBand === "high" ? 1 : right.riskBand === "medium" ? 2 : 3;
    return leftPriority - rightPriority || right.failProbability - left.failProbability;
  });

  return {
    students,
    bandReport,
    failureReport,
  };
};
