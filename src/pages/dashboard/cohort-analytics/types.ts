import type { BadgeProps } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";
import type {
  AssignmentAnalytics,
  CohortAnalyticsSnapshot,
  CohortRecommendation,
  CriterionAnalytics,
} from "@/lib/cohortRecommendations";

export type AssignmentRow = Pick<
  Tables<"assignments">,
  "id" | "title" | "module_code" | "created_at" | "max_score"
>;

export type SubmissionRow = Pick<
  Tables<"submissions">,
  "id" | "assignment_id" | "student_id" | "student_name" | "student_email" | "status" | "submitted_at"
>;

export type GradeRow = Pick<Tables<"grades">, "submission_id" | "ai_score" | "final_score" | "ai_breakdown">;

export type IntegrityReviewRow = Pick<
  Tables<"academic_integrity_reviews">,
  "submission_id" | "decision" | "lecturer_note" | "updated_at"
>;

export interface GradeBand {
  band: string;
  count: number;
  fill: string;
}

export interface CriterionBreakdownItem {
  criterion: string;
  score: number;
  max_score: number;
}

export interface StudentDirectoryEntry {
  studentId: string;
  name: string;
  email: string | null;
}

export interface CohortAtRiskStudentSummary {
  studentId: string;
  name: string;
  riskLevel: "critical" | "high" | "moderate";
  riskScore: number;
  trend: "declining" | "stable-low" | "volatile";
  signal: string;
  recommendation: string;
  predictedNext: number;
}

export interface LoadedAnalytics {
  assignments: AssignmentAnalytics[];
  snapshot: CohortAnalyticsSnapshot;
  allScores: Array<{ assignmentId: string; score: number }>;
  studentDirectory: Record<string, StudentDirectoryEntry>;
}

export type BadgeVariant = NonNullable<BadgeProps["variant"]>;

export type {
  AssignmentAnalytics,
  CohortAnalyticsSnapshot,
  CohortRecommendation,
  CriterionAnalytics,
};
