import type { CohortAnalyticsSnapshot, CohortRecommendation } from "@/lib/cohortRecommendationsTypes";
import { buildRecommendation, formatPct, weakRubricId } from "@/lib/cohortRecommendationsShared";

export const buildRubricRecommendations = (snapshot: CohortAnalyticsSnapshot): CohortRecommendation[] => {
  const recommendations: CohortRecommendation[] = [];

  snapshot.criteria
    .filter((criterion) => criterion.averagePercent < 50 && criterion.submissionCount > 0 && criterion.assignmentId)
    .slice(0, 4)
    .forEach((criterion) => {
      recommendations.push(
        buildRecommendation({
          id: weakRubricId(snapshot.lecturerId, criterion.assignmentId!, criterion.key),
          type: "rubric weakness",
          ruleCode: "weak_rubric_criterion",
          title: `Weak rubric area: ${criterion.criterion}`,
          summary: `${criterion.criterion} is averaging ${formatPct(criterion.averagePercent)}, below the 50% threshold.`,
          explanation:
            "This recommendation is based on criterion-level scoring already produced by the grading pipeline. It highlights where performance is weakest, not a separate model judgement.",
          severity: criterion.averagePercent < 35 ? "high" : "medium",
          confidence: 0.9,
          recommendedActions: [
            "Review exemplar responses for this criterion with the cohort.",
            "Add a targeted practice task or mini-workshop for this skill.",
            "Check whether rubric wording needs clarification for students.",
          ],
          evidence: {
            assignmentId: criterion.assignmentId,
            assignmentTitle: criterion.assignmentTitle,
            criterion: criterion.criterion,
            metrics: [
              { label: "Criterion average", value: formatPct(criterion.averagePercent) },
              { label: "Submissions", value: String(criterion.submissionCount) },
            ],
          },
          assignmentId: criterion.assignmentId ?? null,
        }),
      );
    });

  return recommendations;
};
