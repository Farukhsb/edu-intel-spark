import type { StudentInterventionRow } from "@/lib/interventions";
import type { CohortSignalRiskBand, CohortSignalStudent } from "@/pages/cohortsignal-demo/demoData";

export type AssignmentRow = {
  id: string;
  title: string;
  module_code: string | null;
};

export type SubmissionRow = {
  id: string;
  assignment_id: string;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  status: string;
  submitted_at: string;
};

export type GradeRow = {
  submission_id: string;
  ai_score: number | null;
  final_score: number | null;
};

export type LabeledObservation<L extends string> = {
  id: string;
  features: number[];
  label: L;
};

export type ConfusionMatrix = {
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
};

export type CrossValidationSummary = {
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

export type CentroidModel<L extends string> = {
  classNames: L[];
  means: number[];
  stdDevs: number[];
  centroids: number[][];
  temperature: number;
};

export type LiveCohortSignalInput = {
  assignments: AssignmentRow[];
  submissions: SubmissionRow[];
  grades: GradeRow[];
  interventions: StudentInterventionRow[];
};

export type LiveCohortSignalObservation = LabeledObservation<"low" | "medium" | "high"> & {
  trajectory: import("@/lib/studentRisk").StudentTrajectory;
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
};

export type CohortSignalRiskBandType = CohortSignalRiskBand;
