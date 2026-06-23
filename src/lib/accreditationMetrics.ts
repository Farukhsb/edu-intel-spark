export { deriveAccreditationMetrics } from "@/lib/accreditationMetricsDerivation";
export { deriveProgrammeReports } from "@/lib/accreditationMetricsReports";
export {
  ensureNumber,
  ensureString,
  percentTrend,
  resolveGradeScore,
  tefRating,
} from "@/lib/accreditationMetricsShared";
export type {
  AssignmentAnalytics,
  CohortAnalyticsSnapshot,
  CohortReportingReadiness,
  CriterionAnalytics,
  FeedbackTurnaroundSummary,
  NSSMetric,
  ProgrammeReport,
  QAAMetric,
  TEFIndicator,
} from "@/lib/accreditationMetricsTypes";
