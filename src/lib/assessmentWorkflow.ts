export type AssessmentWorkflowStatus =
  | "submitted"
  | "ai_grading"
  | "ai_graded"
  | "first_review"
  | "moderation_pending"
  | "moderation_in_progress"
  | "moderated"
  | "escalated"
  | "under_review"
  | "approved"
  | "released";

export const REVIEW_QUEUE_STATUSES: AssessmentWorkflowStatus[] = [
  "submitted",
  "ai_grading",
  "ai_graded",
  "first_review",
  "moderation_pending",
  "moderation_in_progress",
  "escalated",
  "under_review",
];

export const GRADED_WORKFLOW_STATUSES: AssessmentWorkflowStatus[] = [
  "ai_graded",
  "first_review",
  "moderation_pending",
  "moderation_in_progress",
  "moderated",
  "escalated",
  "under_review",
  "approved",
  "released",
];

export const MODERATION_BLOCKING_STATUSES: AssessmentWorkflowStatus[] = [
  "moderation_pending",
  "moderation_in_progress",
  "escalated",
];

export const RELEASE_READY_STATUSES: AssessmentWorkflowStatus[] = ["approved"];

export interface WorkflowGradeLike {
  ai_score?: number | null;
  lecturer_score?: number | null;
  final_score?: number | null;
  ai_feedback?: string | null;
  lecturer_feedback?: string | null;
  final_feedback?: string | null;
}

export interface WorkflowModerationLike {
  final_agreed_score?: number | null;
  final_agreed_feedback?: string | null;
}

export const isReviewQueueStatus = (status: string) =>
  REVIEW_QUEUE_STATUSES.includes(status as AssessmentWorkflowStatus);

export const isGradedWorkflowStatus = (status: string) =>
  GRADED_WORKFLOW_STATUSES.includes(status as AssessmentWorkflowStatus);

export const isModerationBlockingStatus = (status: string) =>
  MODERATION_BLOCKING_STATUSES.includes(status as AssessmentWorkflowStatus);

export const canReleaseStatus = (status: string) =>
  RELEASE_READY_STATUSES.includes(status as AssessmentWorkflowStatus);

export const isStudentGradeVisible = (status: string) => status === "released";

export const getAssessmentSummary = (submissions: Array<{ status: string }>) => {
  const submittedCount = submissions.length;
  const gradedCount = submissions.filter((submission) => isGradedWorkflowStatus(submission.status)).length;
  const releasedCount = submissions.filter((submission) => isStudentGradeVisible(submission.status)).length;
  const pendingCount = submissions.filter((submission) => isReviewQueueStatus(submission.status)).length;

  return {
    submittedCount,
    gradedCount,
    releasedCount,
    pendingCount,
  };
};

export const resolveFinalGradeValues = ({
  grade,
  moderationCase,
}: {
  grade: WorkflowGradeLike;
  moderationCase?: WorkflowModerationLike | null;
}) => ({
  finalScore:
    moderationCase?.final_agreed_score ??
    grade.final_score ??
    grade.lecturer_score ??
    grade.ai_score ??
    null,
  finalFeedback:
    moderationCase?.final_agreed_feedback ??
    grade.final_feedback ??
    grade.lecturer_feedback ??
    grade.ai_feedback ??
    null,
});

export const getApprovalBlockReason = ({
  status,
  needsModeration,
}: {
  status: string;
  needsModeration: boolean;
}) => {
  if (isModerationBlockingStatus(status)) {
    return "moderation_in_progress";
  }

  if (needsModeration && status !== "moderated") {
    return "moderation_required";
  }

  return null;
};
