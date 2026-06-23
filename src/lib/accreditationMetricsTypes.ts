export interface QAAMetric {
  id: string;
  category: string;
  metric: string;
  value: number;
  target: number;
  status: "met" | "at-risk" | "below";
  detail: string;
}

export interface NSSMetric {
  question: string;
  score: number;
  benchmark: number;
  trend: string;
}

export interface TEFIndicator {
  name: string;
  rating: "gold" | "silver" | "bronze" | "pending";
  score: number;
  detail: string;
}

export interface FeedbackTurnaroundSummary {
  avg: number;
  target: number;
  compliant: number;
  total: number;
}

export interface ProgrammeReport {
  code: string;
  submissions: number;
  graded: number;
  avg: number;
  passRate: number;
  firstClass: number;
  twoOne: number;
  twoTwo: number;
  third: number;
  fail: number;
}

export interface AssignmentAnalytics {
  id: string;
  title: string;
  moduleCode: string | null;
  avgScore: number;
  failRate: number;
  passRate: number;
  gradedCount: number;
  submissions: number;
  createdAt: string | null;
}

export interface CriterionAnalytics {
  key: string;
  criterion: string;
  avgScore: number;
  averagePercent: number;
  submissionCount: number;
  assignmentId?: string;
  assignmentTitle?: string;
}

export interface CohortAnalyticsSnapshot {
  lecturerId: string;
  cohortAverage: number;
  failRate: number;
  gradedCount: number;
  assignments: AssignmentAnalytics[];
  criteria: CriterionAnalytics[];
  atRiskStudents: import("@/lib/studentRisk").AtRiskStudent[];
  highRiskStudents: import("@/lib/studentRisk").AtRiskStudent[];
  integrityFlaggedCount: number;
  integritySubmissionCount: number;
  integrityFlaggedSubmissionIds: string[];
  integrityByAssignment: Array<{
    assignmentId: string;
    assignmentTitle: string;
    flaggedCount: number;
    submissionCount: number;
    flaggedSubmissionIds: string[];
  }>;
}

export interface CohortReportingReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}
