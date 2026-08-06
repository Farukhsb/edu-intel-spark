import type { CohortAnalyticsSnapshot, CohortRecommendation } from "@/lib/cohortRecommendationsTypes";
import { buildRecommendation, formatPct, integritySpikeId } from "@/lib/cohortRecommendationsShared";

export const buildIntegrityRecommendations = (snapshot: CohortAnalyticsSnapshot): CohortRecommendation[] => {
  const recommendations: CohortRecommendation[] = [];

  snapshot.integrityByAssignment.forEach((assignmentIntegrity) => {
    const integrityThreshold = Math.max(3, Math.ceil(assignmentIntegrity.submissionCount * 0.2));
    if (assignmentIntegrity.flaggedCount < integrityThreshold || assignmentIntegrity.flaggedCount === 0) {
      return;
    }

    recommendations.push(
      buildRecommendation({
        id: integritySpikeId(snapshot.lecturerId, assignmentIntegrity.assignmentId),
        type: "integrity alerts",
        ruleCode: "integrity_spike",
        title: "Integrity flags have spiked",
        summary: `${assignmentIntegrity.flaggedCount} submissions in ${assignmentIntegrity.assignmentTitle} have active integrity concerns, above the current alert threshold of ${integrityThreshold}.`,
        explanation:
          "This is derived from persisted academic integrity review data, including AI-writing, similarity, and baseline-deviation signals already generated elsewhere in the platform.",
        severity: assignmentIntegrity.flaggedCount >= integrityThreshold * 2 ? "critical" : "high",
        confidence: 0.93,
        recommendedActions: [
          "Open the integrity queue and review the highest-risk cases first.",
          "Check whether the spike is clustered around one assignment or cohort segment.",
          "Communicate academic integrity expectations before the next submission.",
        ],
        evidence: {
          assignmentId: assignmentIntegrity.assignmentId,
          assignmentTitle: assignmentIntegrity.assignmentTitle,
          flaggedSubmissionIds: assignmentIntegrity.flaggedSubmissionIds.slice(0, 10),
          metrics: [
            { label: "Flagged submissions", value: String(assignmentIntegrity.flaggedCount) },
            { label: "Alert threshold", value: String(integrityThreshold) },
          ],
        },
        assignmentId: assignmentIntegrity.assignmentId,
      }),
    );
  });

  return recommendations;
};
