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

export interface LecturerWorkflowLaneSummary {
  intakeCount: number;
  aiInProgressCount: number;
  firstReviewCount: number;
  manualReviewCount: number;
  moderationCount: number;
  releaseReadyCount: number;
  releasedCount: number;
}

export interface LecturerSelectionGuidance {
  headline: string;
  detail: string;
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

export const getLecturerWorkflowLaneSummary = (statuses: string[]): LecturerWorkflowLaneSummary => ({
  intakeCount: statuses.filter((status) => status === "submitted").length,
  aiInProgressCount: statuses.filter((status) => status === "ai_grading").length,
  firstReviewCount: statuses.filter((status) => ["ai_graded", "first_review"].includes(status)).length,
  manualReviewCount: statuses.filter((status) => status === "under_review").length,
  moderationCount: statuses.filter((status) => isModerationBlockingStatus(status) || status === "moderated").length,
  releaseReadyCount: statuses.filter((status) => canReleaseStatus(status)).length,
  releasedCount: statuses.filter((status) => status === "released").length,
});

export const getLecturerSelectionGuidance = (statuses: string[]): LecturerSelectionGuidance => {
  if (statuses.length === 0) {
    return {
      headline: "Select submissions to move the workflow forward",
      detail: "Choose one clear lane at a time so grading, approval, moderation, and release actions do not get mixed together.",
    };
  }

  const laneSummary = getLecturerWorkflowLaneSummary(statuses);

  if (laneSummary.releaseReadyCount > 0) {
    return {
      headline: "Release-ready submissions selected",
      detail: `${laneSummary.releaseReadyCount} approved submission${laneSummary.releaseReadyCount === 1 ? " is" : "s are"} ready for student release. Release them only after the final feedback and score look correct.`,
    };
  }

  if (laneSummary.moderationCount > 0) {
    return {
      headline: "Moderation-linked submissions are selected",
      detail: "These submissions are blocked from normal approval or release until the moderation outcome is clear. Review the moderation state before taking the next action.",
    };
  }

  if (statuses.some((status) => isApprovableWorkflowStatus(status))) {
    return {
      headline: "Reviewed submissions are ready for approval",
      detail: "Use approval once the first review is complete and no moderation blocker remains. Approval should confirm the final internal marking decision before release.",
    };
  }

  if (laneSummary.manualReviewCount > 0) {
    return {
      headline: "Manual-review submissions are selected",
      detail: "These submissions bypassed AI grading and now need a lecturer-owned score and feedback before they can move to approval or moderation.",
    };
  }

  if (laneSummary.firstReviewCount > 0) {
    return {
      headline: "First-review work is selected",
      detail: "These submissions already have AI output. Open the review surface, confirm or adjust the score and feedback, and let the workflow decide whether moderation is needed.",
    };
  }

  if (laneSummary.aiInProgressCount > 0) {
    return {
      headline: "AI grading is still running",
      detail: "Wait for grading to finish before trying to approve or release these submissions. If a run stalls, retry grading or continue with manual review.",
    };
  }

  if (laneSummary.intakeCount > 0) {
    return {
      headline: "New submissions are waiting for grading",
      detail: "Start with AI grading or manual review so these files can enter the first-review lane instead of sitting in raw intake.",
    };
  }

  if (laneSummary.releasedCount > 0) {
    return {
      headline: "Released submissions are selected",
      detail: "These outcomes are already student-visible. Use them for export, follow-up, or audit review rather than workflow progression.",
    };
  }

  return {
    headline: "Selection includes mixed workflow states",
    detail: "Split the selection into one operational lane so the next action is obvious and safe.",
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
