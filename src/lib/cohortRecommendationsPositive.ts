import type { CohortAnalyticsSnapshot, CohortRecommendation } from "@/lib/cohortRecommendationsTypes";
import { buildRecommendation, formatPct, positiveSignalId } from "@/lib/cohortRecommendationsShared";

export const buildPositiveRecommendations = (snapshot: CohortAnalyticsSnapshot): CohortRecommendation[] => {
  const recommendations: CohortRecommendation[] = [];

  if (snapshot.gradedCount > 0 && snapshot.cohortAverage >= 70 && snapshot.failRate <= 10) {
    recommendations.push(
      buildRecommendation({
        id: positiveSignalId(snapshot.lecturerId, "all"),
        type: "positive signals",
        ruleCode: "positive_cohort_signal",
        title: "Strong positive cohort signal",
        summary: `The cohort is averaging ${formatPct(snapshot.cohortAverage)} with only ${formatPct(snapshot.failRate)} below pass level.`,
        explanation:
          "Positive recommendations are generated from the same deterministic analytics so lecturers can identify what is working and preserve it.",
        severity: "low",
        confidence: 0.9,
        recommendedActions: [
          "Capture the teaching or assessment practices that contributed to this result.",
          "Use the strongest scripts as exemplars for future cohorts.",
        ],
        evidence: {
          metrics: [
            { label: "Cohort average", value: formatPct(snapshot.cohortAverage) },
            { label: "Failure rate", value: formatPct(snapshot.failRate) },
          ],
        },
        assignmentId: null,
      }),
    );
  }

  return recommendations;
};
