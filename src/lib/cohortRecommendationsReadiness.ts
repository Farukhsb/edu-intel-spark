import type { AssignmentAnalytics, CohortRecommendation, CohortReportingReadiness } from "@/lib/cohortRecommendationsTypes";
import { sortByPriority } from "@/lib/cohortRecommendationsShared";

export function getCohortReportingReadiness({
  assignments,
  recommendations,
}: {
  assignments: AssignmentAnalytics[];
  recommendations: CohortRecommendation[];
}): CohortReportingReadiness {
  const highestPriorityRecommendation = [...recommendations].sort(sortByPriority)[0];
  const weakestAssignment = [...assignments]
    .filter((assignment) => assignment.gradedCount > 0)
    .sort((left, right) => left.avgScore - right.avgScore)[0];
  const criticalCount = recommendations.filter((recommendation) => recommendation.severity === "critical").length;
  const highCount = recommendations.filter((recommendation) => recommendation.severity === "high").length;

  return {
    postureLabel:
      criticalCount > 0
        ? "Immediate intervention position"
        : highCount > 0 || (weakestAssignment?.avgScore ?? 100) < 55
          ? "Watch list position"
          : "Stable oversight position",
    likelyChallenge:
      highestPriorityRecommendation?.title ||
      weakestAssignment?.title ||
      "No cohort pressure point yet",
    bestNextAction:
      highestPriorityRecommendation?.recommendedActions[0] ||
      (weakestAssignment
        ? "Review the weakest assignment before the next release cycle"
        : "Maintain current cohort monitoring"),
  };
}
