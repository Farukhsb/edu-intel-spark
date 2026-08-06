import type { CohortAnalyticsSnapshot, CohortRecommendation } from "@/lib/cohortRecommendationsTypes";
import { buildRecommendation, formatPct, scoreDropId } from "@/lib/cohortRecommendationsShared";

export const buildTrendRecommendations = (snapshot: CohortAnalyticsSnapshot): CohortRecommendation[] => {
  const recommendations: CohortRecommendation[] = [];
  const latestAssignments = [...snapshot.assignments]
    .filter((assignment) => assignment.gradedCount > 0)
    .sort((left, right) => new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime());

  for (let index = 1; index < latestAssignments.length; index++) {
    const previous = latestAssignments[index - 1];
    const current = latestAssignments[index];
    const drop = previous.avgScore - current.avgScore;
    if (drop < 10) continue;

    recommendations.push(
      buildRecommendation({
        id: scoreDropId(snapshot.lecturerId, current.id, previous.id),
        type: "trends",
        ruleCode: "assignment_score_drop",
        title: "Assignment average has dropped sharply",
        summary: `${current.title} is ${Math.round(drop)} points below ${previous.title}.`,
        explanation:
          "A double-digit average drop between adjacent assignments usually indicates a material jump in difficulty, weaker preparation, or misalignment with expectations.",
        severity: drop >= 15 ? "high" : "medium",
        confidence: 0.92,
        recommendedActions: [
          "Review the assessment brief and sample answers with the cohort.",
          "Compare weaker students' performance against the prior task.",
          "Check whether a specific criterion or topic caused the drop.",
        ],
        evidence: {
          assignmentId: current.id,
          assignmentTitle: current.title,
          previousAssignmentId: previous.id,
          previousAssignmentTitle: previous.title,
          metrics: [
            { label: previous.title, value: formatPct(previous.avgScore) },
            { label: current.title, value: formatPct(current.avgScore) },
            { label: "Difference", value: `${Math.round(drop)} pts lower` },
          ],
        },
        assignmentId: current.id,
      }),
    );
  }

  return recommendations;
};
