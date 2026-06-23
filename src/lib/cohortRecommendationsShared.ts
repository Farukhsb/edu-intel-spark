import type { CohortRecommendation, RecommendationSeverity } from "@/lib/cohortRecommendationsTypes";

export const sortByPriority = (left: CohortRecommendation, right: CohortRecommendation) => {
  const rank: Record<RecommendationSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  if (rank[left.severity] !== rank[right.severity]) {
    return rank[left.severity] - rank[right.severity];
  }

  return left.title.localeCompare(right.title);
};

export const formatPct = (value: number) => `${Math.round(value)}%`;

export const buildRecommendation = (
  data: Omit<CohortRecommendation, "status" | "createdAt">,
): CohortRecommendation => ({
  ...data,
  status: "open",
  createdAt: new Date().toISOString(),
});

export const lowCohortAverageId = (lecturerId: string, assignmentId: string) =>
  `low-cohort-average:${lecturerId}:${assignmentId}`;

export const highFailureRateId = (lecturerId: string, assignmentId: string) =>
  `high-failure-rate:${lecturerId}:${assignmentId}`;

export const scoreDropId = (lecturerId: string, currentAssignmentId: string, previousAssignmentId: string) =>
  `score-drop:${lecturerId}:${currentAssignmentId}:${previousAssignmentId}`;

export const weakRubricId = (lecturerId: string, assignmentId: string, criterionKey: string) =>
  `weak-rubric:${lecturerId}:${assignmentId}:${criterionKey}`;

export const highRiskClusterId = (lecturerId: string, cohortKey: string) =>
  `high-risk-cluster:${lecturerId}:${cohortKey}`;

export const integritySpikeId = (lecturerId: string, assignmentId: string) =>
  `integrity-spike:${lecturerId}:${assignmentId}`;

export const positiveSignalId = (lecturerId: string, cohortKey: string) =>
  `positive-cohort-signal:${lecturerId}:${cohortKey}`;
