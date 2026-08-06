import type { CohortAnalyticsSnapshot, CohortRecommendation } from "@/lib/cohortRecommendationsTypes";
import { sortByPriority } from "@/lib/cohortRecommendationsShared";
import { buildIntegrityRecommendations } from "@/lib/cohortRecommendationsIntegrity";
import { buildPerformanceRecommendations } from "@/lib/cohortRecommendationsPerformance";
import { buildPositiveRecommendations } from "@/lib/cohortRecommendationsPositive";
import { buildRiskRecommendations } from "@/lib/cohortRecommendationsRisk";
import { buildRubricRecommendations } from "@/lib/cohortRecommendationsRubric";
import { buildTrendRecommendations } from "@/lib/cohortRecommendationsTrends";

export function buildCohortRecommendations(snapshot: CohortAnalyticsSnapshot): CohortRecommendation[] {
  const recommendations: CohortRecommendation[] = [
    ...buildPerformanceRecommendations(snapshot),
    ...buildTrendRecommendations(snapshot),
    ...buildRubricRecommendations(snapshot),
    ...buildRiskRecommendations(snapshot),
    ...buildIntegrityRecommendations(snapshot),
    ...buildPositiveRecommendations(snapshot),
  ];

  return recommendations.sort(sortByPriority);
}
