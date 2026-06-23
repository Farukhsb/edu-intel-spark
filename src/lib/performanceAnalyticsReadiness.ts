import type {
  AssessmentTrendEntry,
  GradeDistributionEntry,
  PerformanceReportingReadiness,
} from "@/lib/performanceAnalyticsTypes";

export const getPerformanceReportingReadiness = ({
  assessmentTrends,
  atRiskStudents,
  gradeDist,
}: {
  assessmentTrends: AssessmentTrendEntry[];
  atRiskStudents: { riskLevel: "critical" | "high" | "moderate" | "low"; }[];
  gradeDist: GradeDistributionEntry[];
}): PerformanceReportingReadiness => {
  const criticalStudents = atRiskStudents.filter((student) => student.riskLevel === "critical");
  const highStudents = atRiskStudents.filter((student) => student.riskLevel === "high");
  const failingBand = gradeDist.find((entry) => entry.band === "Fail (<40%)");
  const weakestAssessment = assessmentTrends.reduce<AssessmentTrendEntry | null>(
    (currentWeakest, currentAssessment) =>
      currentWeakest === null || currentAssessment.avgGrade < currentWeakest.avgGrade
        ? currentAssessment
        : currentWeakest,
    null,
  );

  return {
    postureLabel:
      criticalStudents.length > 0 || (failingBand?.count ?? 0) > 0
        ? "Immediate intervention position"
        : highStudents.length > 0 || (weakestAssessment?.avgGrade ?? 100) < 55
          ? "Watch list position"
          : "Stable monitoring position",
    likelyChallenge:
      weakestAssessment?.name ||
      (criticalStudents.length > 0
        ? "Critical student trajectory risk"
        : "No performance pressure point yet"),
    bestNextAction:
      criticalStudents.length > 0 || highStudents.length > 0
        ? "Open early support signals and act on high-risk students"
        : weakestAssessment && weakestAssessment.avgGrade < 60
          ? "Review the weakest assessment before the next release cycle"
          : "Maintain current performance monitoring",
  };
};
