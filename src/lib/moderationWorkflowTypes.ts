import type { Tables } from "@/integrations/supabase/types";

export type ModerationCaseRow = Tables<"moderation_cases">;
export type SubmissionRow = Tables<"submissions">;
export type GradeRow = Tables<"grades">;
export type AssignmentRow = Tables<"assignments">;
export type ModerationReviewRow = Tables<"moderation_reviews">;
export type GradeAuditRow = Tables<"grade_audit_log">;
export type ProfileRow = Tables<"profiles">;
export type IntegrityReviewRow = Tables<"academic_integrity_reviews">;

export interface ModerationCaseView {
  moderationCase: ModerationCaseRow;
  submission: SubmissionRow | null;
  grade: GradeRow | null;
  assignment: AssignmentRow | null;
  firstMarker: ProfileRow | null;
  moderator: ProfileRow | null;
  integrityReview: IntegrityReviewRow | null;
  reviews: ModerationReviewRow[];
  auditLog: GradeAuditRow[];
}

export type ModerationQueueFilter =
  | "all"
  | "assigned_to_me"
  | "awaiting_my_approval"
  | "escalated"
  | "ready_for_release";

export type ModerationQueueSort = "priority" | "newest" | "student";

export interface ModerationOwnerAssignmentSummary {
  assignmentId: string;
  assignmentTitle: string;
  approvedReadyCount: number;
  escalatedCount: number;
}

export interface ModerationNextStepSummary {
  actor: "moderator" | "owner" | "system" | "senior_review";
  headline: string;
  detail: string;
  tone: "ready" | "warning" | "blocked" | "progress" | "resolved";
}
