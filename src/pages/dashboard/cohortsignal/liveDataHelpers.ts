import type { StudentInterventionRow } from "@/lib/interventions";
import type { AssignmentRow, SubmissionRow } from "./liveData.types";

import type { CohortSignalStudent } from "@/pages/cohortsignal-demo/demoData";

export const getTrend = (slope: number) => {
  if (slope > 1) return "improving";
  if (slope < -1) return "declining";
  return "steady";
};

export const getSlope = (values: number[]) => {
  const n = values.length;
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i += 1) {
    const value = values[i] as number;
    sumX += i;
    sumY += value;
    sumXY += i * value;
    sumXX += i * i;
  }

  const denominator = n * sumXX - sumX * sumX;
  return (n * sumXY - sumX * sumY) / denominator;
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

export const getCohortSignalStudentInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase())
    .join("")
    .slice(0, 2);

export const getCohortSignalStudentSortPriority = (
  student: Pick<CohortSignalStudent, "predictedToFail" | "riskBand" | "failProbability">,
) => {
  return student.predictedToFail ? 0 : student.riskBand === "high" ? 1 : student.riskBand === "medium" ? 2 : 3;
};

export const resolveCohortSignalRiskReasonLabel = (reason: string) => riskReasonLabelByCode[reason] ?? reason;

export const resolveCohortSignalLatestMark = (scores: number[], averageMark: number) => scores[scores.length - 1] ?? averageMark;

export const resolveCohortSignalInterventionLoggedAt = (intervention?: { created_at?: string | null; updated_at?: string | null } | null) =>
  intervention?.created_at ?? intervention?.updated_at ?? null;

export const resolveCohortSignalRiskReasons = (reasonCodes: string[] | undefined) => reasonCodes ?? ["baseline_monitoring"];

export const resolveCohortSignalSuggestedAction = (recommendation: string | undefined, interventionLoggedAt: string | null) =>
  `${recommendation ?? "Schedule a check-in to review study strategies and agree short-term goals."}${
    interventionLoggedAt ? " Follow up on the logged intervention and confirm the next step." : ""
  }`;

export const resolveCohortSignalLatestIntervention = (
  current: StudentInterventionRow | undefined,
  next: StudentInterventionRow,
) => {
  if (!current) return next;

  const nextTimestamp = new Date(next.created_at ?? next.updated_at ?? "").getTime();
  const currentTimestamp = new Date(current.created_at ?? current.updated_at ?? "").getTime();
  return nextTimestamp > currentTimestamp ? next : current;
};

export const resolveCohortSignalSubmissionKey = (submission: Pick<SubmissionRow, "student_id" | "student_email" | "student_name" | "id">) =>
  submission.student_id || submission.student_email || submission.student_name || submission.id;

export const resolveCohortSignalStudentName = (submission: Pick<SubmissionRow, "student_name" | "student_email">) =>
  submission.student_name || submission.student_email || "Student";

export const resolveCohortSignalStudentModule = (assignment?: Pick<AssignmentRow, "module_code" | "title"> | null) =>
  assignment?.module_code || assignment?.title || "General";

export const resolveCohortSignalAssignmentTitle = (assignment?: Pick<AssignmentRow, "title"> | null) =>
  assignment?.title || "Assignment";

export const shouldSkipCohortSignalTrajectory = (scores: number[]) => scores.length === 0;

export const resolveCohortSignalPredictedNext = (evaluationPredictedNext: number | undefined, averageMark: number) =>
  evaluationPredictedNext ?? Math.round(averageMark);

export const resolveCohortSignalFailureProbability = (probabilities: number[]) => Math.round((probabilities[1] ?? 0) * 100);
