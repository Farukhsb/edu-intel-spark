export const OVERDUE_MODERATION_DAYS = 7;

export type ModerationCaseAuditSourceRow = {
  id: string;
  assignment_id: string;
  submission_id: string | null;
  moderator_id: string | null;
  status: string;
  final_agreed_score: number | null;
  final_agreed_feedback: string | null;
  created_at: string;
  updated_at: string;
};

export type GradeAuditModerationSourceRow = {
  moderation_case_id: string | null;
  event_type: string;
  reason: string | null;
};

export type IntegrityReviewPolicySourceRow = {
  id: string;
  submission_id: string;
  decision: string;
  lecturer_note: string | null;
  updated_at: string;
};

export const isOverdueModerationCase = (status: string, ageInDays: number) =>
  (status === "moderation_pending" || status === "moderation_in_progress" || status === "escalated") &&
  ageInDays >= OVERDUE_MODERATION_DAYS;

export const hasUnresolvedReleasedGrade = (submissionStatus: string | undefined, moderationStatus: string) =>
  submissionStatus === "released" && moderationStatus !== "approved";

export const needsAssignedModerator = (status: string, moderatorId: string | null) =>
  (status === "moderation_pending" || status === "moderation_in_progress") && !moderatorId;

export const shouldFlagHighIntegrityReview = (riskScore: number, decision: string) =>
  riskScore >= 80 || decision === "misconduct-concern";
