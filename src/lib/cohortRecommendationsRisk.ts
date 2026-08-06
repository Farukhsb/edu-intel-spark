import type { CohortAnalyticsSnapshot, CohortRecommendation } from "@/lib/cohortRecommendationsTypes";
import { buildRecommendation, formatPct, highRiskClusterId } from "@/lib/cohortRecommendationsShared";

export const buildRiskRecommendations = (snapshot: CohortAnalyticsSnapshot): CohortRecommendation[] => {
  const recommendations: CohortRecommendation[] = [];
  const highRiskCount = snapshot.highRiskStudents.length;
  const highRiskPct =
    snapshot.atRiskStudents.length > 0 ? (highRiskCount / Math.max(snapshot.atRiskStudents.length, 1)) * 100 : 0;

  if (
    highRiskCount >= 8 ||
    (snapshot.atRiskStudents.length > 0 && (highRiskCount / Math.max(snapshot.atRiskStudents.length, 1)) >= 0.15)
  ) {
    const affected = snapshot.highRiskStudents.slice(0, 5);
    recommendations.push(
      buildRecommendation({
        id: highRiskClusterId(snapshot.lecturerId, "all"),
        type: "student risk",
        ruleCode: "high_risk_student_cluster",
        title: "High-risk student cluster detected",
        summary: `${highRiskCount} students are in the high or critical risk band.`,
        explanation:
          "This uses the existing trajectory-based risk engine. The recommendation is triggered when the cluster size is large enough to justify cohort-level intervention planning.",
        severity: highRiskCount >= 12 ? "critical" : "high",
        confidence: 0.94,
        recommendedActions: [
          "Open the risk workflow and prioritise the highest-risk students.",
          "Create targeted check-ins or support referrals for affected students.",
          "Review whether one assignment or topic is driving the risk cluster.",
        ],
        evidence: {
          metrics: [
            { label: "High-risk students", value: String(highRiskCount) },
            { label: "Risk share of flagged cohort", value: formatPct(highRiskPct) },
          ],
          affectedStudentIds: affected.map((student) => student.studentId),
          affectedStudentNames: affected.map((student) => student.name),
        },
        assignmentId: null,
      }),
    );
  }

  return recommendations;
};
