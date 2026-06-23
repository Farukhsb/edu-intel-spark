export { buildPerformanceProjection } from "@/lib/performanceAnalyticsProjection";
export {
  EMPTY_GRADE_DIST,
  buildAtRiskStudentFilterIndex,
  buildGradeDistribution,
  filterAtRiskStudents,
} from "@/lib/performanceAnalyticsShared";
export { getPerformanceReportingReadiness } from "@/lib/performanceAnalyticsReadiness";
export type {
  AssessmentTrendEntry,
  AtRiskStudentFilterIndex,
  AtRiskStudentFilterKey,
  GradeDistributionEntry,
  PerformanceAssignmentLike,
  PerformanceGradeLike,
  PerformanceProjection,
  PerformanceReportingReadiness,
  PerformanceSubmissionLike,
  RiskFilterValue,
  ScoreBandFilterValue,
} from "@/lib/performanceAnalyticsTypes";
