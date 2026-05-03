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

export const REGRADABLE_WORKFLOW_STATUSES: AssessmentWorkflowStatus[] = [
  "submitted",
  "ai_graded",
  "first_review",
  "moderation_pending",
  "moderation_in_progress",
  "moderated",
  "escalated",
  "under_review",
  "approved",
];

export const APPROVABLE_WORKFLOW_STATUSES: AssessmentWorkflowStatus[] = [
  "first_review",
  "moderated",
  "under_review",
];

export const FIRST_REVIEW_EDITABLE_STATUSES: AssessmentWorkflowStatus[] = [
  "ai_graded",
  "first_review",
  "under_review",
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

export interface WorkflowDisplayStateInput {
  status: string;
  grade?: WorkflowGradeLike | null;
  moderationCase?: WorkflowModerationLike | null;
  isLecturer: boolean;
}

export const isReviewQueueStatus = (status: string) =>
  REVIEW_QUEUE_STATUSES.includes(status as AssessmentWorkflowStatus);

export const isGradedWorkflowStatus = (status: string) =>
  GRADED_WORKFLOW_STATUSES.includes(status as AssessmentWorkflowStatus);

export const isRegradableWorkflowStatus = (status: string) =>
  REGRADABLE_WORKFLOW_STATUSES.includes(status as AssessmentWorkflowStatus);

export const isApprovableWorkflowStatus = (status: string) =>
  APPROVABLE_WORKFLOW_STATUSES.includes(status as AssessmentWorkflowStatus);

export const isFirstReviewEditableStatus = (status: string) =>
  FIRST_REVIEW_EDITABLE_STATUSES.includes(status as AssessmentWorkflowStatus);

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

export const getSelectedWorkflowActionState = (statuses: string[]) => {
  const submittedCount = statuses.filter((status) => status === "submitted").length;
  const regradableCount = statuses.filter((status) => isRegradableWorkflowStatus(status)).length;
  const approvableCount = statuses.filter((status) => isApprovableWorkflowStatus(status)).length;
  const releaseReadyCount = statuses.filter((status) => canReleaseStatus(status)).length;

  return {
    submittedCount,
    regradableCount,
    approvableCount,
    releaseReadyCount,
    hasRegradable: regradableCount > 0,
    hasApprovable: approvableCount > 0,
    hasReleaseReady: releaseReadyCount > 0,
  };
};

export const getSubmissionDisplayState = ({
  status,
  grade,
  moderationCase,
  isLecturer,
}: WorkflowDisplayStateInput) => {
  const hasGrade = Boolean(grade && grade.ai_score != null);
  const { finalScore, finalFeedback } = grade
    ? resolveFinalGradeValues({
        grade,
        moderationCase,
      })
    : { finalScore: null, finalFeedback: null };
  const studentVisible = isStudentGradeVisible(status);
  const releaseReady = canReleaseStatus(status);
  const canEditFirstReview = hasGrade && isFirstReviewEditableStatus(status);
  const canApprove = hasGrade && isApprovableWorkflowStatus(status);

  return {
    scoreToDisplay: finalScore,
    studentVisibleFeedback: studentVisible ? finalFeedback : null,
    showFeedbackSummary: isLecturer && hasGrade,
    showFirstReview: isLecturer && canEditFirstReview,
    showApprove: isLecturer && canApprove,
    showRelease: isLecturer && releaseReady,
    showReleaseNote: isLecturer && studentVisible,
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
