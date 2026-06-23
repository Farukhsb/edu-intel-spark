import type { AtRiskStudent } from "@/lib/studentRisk";

export type RecommendationType =
  | "performance"
  | "trends"
  | "rubric weakness"
  | "student risk"
  | "integrity alerts"
  | "positive signals";

export type RecommendationSeverity = "critical" | "high" | "medium" | "low";
export type RecommendationStatus = "open" | "reviewed" | "dismissed" | "actioned";

export interface RecommendationEvidence {
  metrics: Array<{ label: string; value: string }>;
  assignmentId?: string;
  assignmentTitle?: string;
  previousAssignmentId?: string;
  previousAssignmentTitle?: string;
  criterion?: string;
  affectedStudentIds?: string[];
  affectedStudentNames?: string[];
  flaggedSubmissionIds?: string[];
}

export interface CohortRecommendation {
  id: string;
  type: RecommendationType;
  ruleCode: string;
  title: string;
  summary: string;
  explanation: string;
  severity: RecommendationSeverity;
  confidence: number;
  recommendedActions: string[];
  evidence: RecommendationEvidence;
  status: RecommendationStatus;
  createdAt: string;
  assignmentId?: string | null;
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
  atRiskStudents: AtRiskStudent[];
  highRiskStudents: AtRiskStudent[];
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
