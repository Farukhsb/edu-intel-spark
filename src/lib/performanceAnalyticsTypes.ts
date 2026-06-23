import type { AtRiskStudent } from "@/lib/studentRisk";

export interface PerformanceAssignmentLike {
  id: string;
  title: string;
  module_code: string | null;
}

export interface PerformanceSubmissionLike {
  id: string;
  assignment_id: string;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  submitted_at: string;
}

export interface PerformanceGradeLike {
  submission_id: string;
  ai_score: number | null;
  final_score: number | null;
}

export interface GradeDistributionEntry {
  band: string;
  count: number;
  percentage: number;
  fill: string;
}

export interface AssessmentTrendEntry {
  name: string;
  avgGrade: number;
  participation: number;
}

export interface PerformanceProjection {
  modules: string[];
  assessmentTrends: AssessmentTrendEntry[];
  gradeDist: GradeDistributionEntry[];
  atRiskStudents: AtRiskStudent[];
}

export interface PerformanceReportingReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

export type RiskFilterValue = "all" | "high-plus" | AtRiskStudent["riskLevel"];
export type ScoreBandFilterValue = "all" | "lt40" | "40-49" | "50-59" | "60plus";

export type AtRiskStudentFilterKey = `${RiskFilterValue}|${ScoreBandFilterValue}`;

export interface AtRiskStudentFilterIndex {
  riskBuckets: Record<RiskFilterValue, AtRiskStudent[]>;
  scoreBandBuckets: Record<ScoreBandFilterValue, AtRiskStudent[]>;
  combinedBuckets: Map<AtRiskStudentFilterKey, AtRiskStudent[]>;
}
