import type { CohortAnalyticsSnapshot, CohortRecommendation } from "@/lib/cohortRecommendationsTypes";
import {
  buildRecommendation,
  formatPct,
  highFailureRateId,
  lowCohortAverageId,
} from "@/lib/cohortRecommendationsShared";

export const buildPerformanceRecommendations = (snapshot: CohortAnalyticsSnapshot): CohortRecommendation[] => {
  const recommendations: CohortRecommendation[] = [];
  const latestAssignments = [...snapshot.assignments]
    .filter((assignment) => assignment.gradedCount > 0)
    .sort((left, right) => new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime());

  latestAssignments
    .filter((assignment) => assignment.avgScore < 45)
    .forEach((assignment) => {
      recommendations.push(
        buildRecommendation({
          id: lowCohortAverageId(snapshot.lecturerId, assignment.id),
          type: "performance",
          ruleCode: "low_cohort_average",
          title: "Low cohort average detected",
          summary: `${assignment.title} is averaging ${formatPct(assignment.avgScore)}, below the 45% threshold.`,
          explanation:
            "This recommendation is triggered from the assignment-level cohort average already used in the Cohort Dashboard. It highlights an assessment where overall performance is materially weak.",
          severity: assignment.avgScore < 35 ? "critical" : "high",
          confidence: 0.96,
          recommendedActions: [
            "Review the lowest-performing rubric criteria for this assignment.",
            "Schedule a targeted recap session before the next deadline.",
            "Check whether task instructions or expectations need clarification.",
          ],
          evidence: {
            assignmentId: assignment.id,
            assignmentTitle: assignment.title,
            metrics: [
              { label: "Assignment average", value: formatPct(assignment.avgScore) },
              { label: "Graded submissions", value: String(assignment.gradedCount) },
            ],
          },
          assignmentId: assignment.id,
        }),
      );
    });

  latestAssignments
    .filter((assignment) => assignment.failRate > 35)
    .forEach((assignment) => {
      recommendations.push(
        buildRecommendation({
          id: highFailureRateId(snapshot.lecturerId, assignment.id),
          type: "performance",
          ruleCode: "high_failure_rate",
          title: "High failure rate across the cohort",
          summary: `${formatPct(assignment.failRate)} of graded submissions in ${assignment.title} are below 40%, above the 35% threshold.`,
          explanation:
            "A high failure rate at assignment level is usually a signal to review assessment alignment, support coverage, or rubric clarity.",
          severity: assignment.failRate > 50 ? "critical" : "high",
          confidence: 0.95,
          recommendedActions: [
            "Review failed scripts for recurring misconceptions.",
            "Contact the highest-risk students before the next submission.",
            "Compare pass rates between assignments to isolate where the drop begins.",
          ],
          evidence: {
            assignmentId: assignment.id,
            assignmentTitle: assignment.title,
            metrics: [
              { label: "Failure rate", value: formatPct(assignment.failRate) },
              { label: "Graded submissions", value: String(assignment.gradedCount) },
            ],
          },
          assignmentId: assignment.id,
        }),
      );
    });

  return recommendations;
};
