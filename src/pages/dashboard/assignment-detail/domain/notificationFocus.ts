import { canReleaseStatus } from "@/lib/assessmentWorkflow";
import type { AssignmentDetailSubmission, SubmissionStatus } from "@/pages/dashboard/assignment-detail/types";

export type AssignmentNotificationFocus =
  | "submission-review"
  | "ai-results"
  | "integrity-review"
  | "release-follow-up";

type AssignmentNotificationResolvedFocus =
  | AssignmentNotificationFocus
  | "moderation-review"
  | "empty";

export interface AssignmentNotificationFocusState {
  requestedFocus: AssignmentNotificationFocus;
  resolvedFocus: AssignmentNotificationResolvedFocus;
  redirected: boolean;
  statusFilter: "all" | SubmissionStatus;
  selectedSubmissionIds: string[];
  visibleSubmissionIds: string[] | null;
  title: string;
  description: string;
}

const filterSubmissionIds = (
  submissions: AssignmentDetailSubmission[],
  predicate: (submission: AssignmentDetailSubmission) => boolean,
) => submissions.filter(predicate).map((submission) => submission.id);

const buildReleaseFollowUpState = ({
  requestedFocus,
  submissionIds,
  statusFilter,
  title,
  description,
}: {
  requestedFocus: AssignmentNotificationFocus;
  submissionIds: string[];
  statusFilter: "all" | SubmissionStatus;
  title: string;
  description: string;
}): AssignmentNotificationFocusState => ({
  requestedFocus,
  resolvedFocus: "release-follow-up",
  redirected: requestedFocus !== "release-follow-up",
  statusFilter,
  selectedSubmissionIds: submissionIds,
  visibleSubmissionIds: submissionIds,
  title,
  description,
});

const buildModerationState = ({
  requestedFocus,
  submissionIds,
  redirected,
}: {
  requestedFocus: AssignmentNotificationFocus;
  submissionIds: string[];
  redirected: boolean;
}): AssignmentNotificationFocusState => ({
  requestedFocus,
  resolvedFocus: "moderation-review",
  redirected,
  statusFilter: "all",
  selectedSubmissionIds: submissionIds,
  visibleSubmissionIds: submissionIds,
  title: redirected
    ? "Opened from an earlier notice after moderation started"
    : "Opened from moderation review notice",
  description: redirected
    ? "The earlier workflow notice has been overtaken by moderation activity, so the list is focused on submissions currently blocked in moderation or escalation."
    : "This assignment notice is focused on submissions currently in moderation or escalation.",
});

export const getAssignmentNotificationFocusState = (
  focus: AssignmentNotificationFocus | null,
  submissions: AssignmentDetailSubmission[],
): AssignmentNotificationFocusState | null => {
  if (!focus) return null;

  const releaseReadySubmissionIds = filterSubmissionIds(submissions, (submission) =>
    canReleaseStatus(submission.status),
  );
  const releasedSubmissionIds = filterSubmissionIds(
    submissions,
    (submission) => submission.status === "released",
  );
  const moderationSubmissionIds = filterSubmissionIds(
    submissions,
    (submission) =>
      submission.status === "moderation_pending" ||
      submission.status === "moderation_in_progress" ||
      submission.status === "escalated",
  );
  const aiResultSubmissionIds = filterSubmissionIds(
    submissions,
    (submission) =>
      submission.status === "ai_graded" ||
      submission.status === "first_review" ||
      submission.status === "moderated" ||
      submission.status === "under_review",
  );
  const submissionReviewIds = filterSubmissionIds(
    submissions,
    (submission) =>
      submission.status === "submitted" || submission.status === "ai_grading",
  );

  if (releaseReadySubmissionIds.length > 0) {
    return buildReleaseFollowUpState({
      requestedFocus: focus,
      submissionIds: releaseReadySubmissionIds,
      statusFilter: "approved",
      title:
        focus === "release-follow-up"
          ? "Opened from release-ready notice"
          : "Opened from an earlier notice after approval",
      description:
        focus === "release-follow-up"
          ? "This assignment notification points to approved submissions that are ready to release to students."
          : "The earlier workflow notice has already moved into approval and release readiness, so the list is focused on approved submissions waiting to be released.",
    });
  }

  if (moderationSubmissionIds.length > 0) {
    return buildModerationState({
      requestedFocus: focus,
      submissionIds: moderationSubmissionIds,
      redirected: focus !== "release-follow-up" || moderationSubmissionIds.length > 0,
    });
  }

  if (focus === "ai-results" || focus === "integrity-review") {
    const ids = aiResultSubmissionIds.length > 0 ? aiResultSubmissionIds : submissionReviewIds;
    return {
      requestedFocus: focus,
      resolvedFocus: focus,
      redirected: false,
      statusFilter: "all",
      selectedSubmissionIds: ids,
      visibleSubmissionIds: ids,
      title:
        focus === "ai-results"
          ? "Opened from AI grading workflow notice"
          : "Opened from integrity workflow notice",
      description:
        focus === "ai-results"
          ? "This assignment notification points to the latest grading-result state for this workflow."
          : "This assignment notification points to the latest integrity-review state for this workflow.",
    };
  }

  if (focus === "submission-review") {
    return {
      requestedFocus: focus,
      resolvedFocus: focus,
      redirected: false,
      statusFilter: submissionReviewIds.length > 0 ? "submitted" : "all",
      selectedSubmissionIds: submissionReviewIds,
      visibleSubmissionIds: submissionReviewIds.length > 0 ? submissionReviewIds : null,
      title: "Opened from submission workflow notice",
      description: "This assignment notification points to the review queue for newly submitted work.",
    };
  }

  if (releasedSubmissionIds.length > 0) {
    return buildReleaseFollowUpState({
      requestedFocus: focus,
      submissionIds: releasedSubmissionIds,
      statusFilter: "released",
      title:
        focus === "release-follow-up"
          ? "Opened from release follow-up notice"
          : "Opened from an earlier notice after release",
      description:
        focus === "release-follow-up"
          ? "This assignment notification points to the released-grade follow-up state for this workflow."
          : "The earlier workflow notice has already been overtaken by released results, so the list is focused on submissions already released to students.",
    });
  }

  if (focus === "release-follow-up") {
    return {
      requestedFocus: focus,
      resolvedFocus: "empty",
      redirected: false,
      statusFilter: "approved",
      selectedSubmissionIds: [],
      visibleSubmissionIds: [],
      title: "Opened from release follow-up notice",
      description: "No approved or released submissions currently match this older release follow-up notice.",
    };
  }

  return null;
};
