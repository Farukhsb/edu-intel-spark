import type { CommunicationMessage } from "@/lib/communications";

export type LecturerAssignmentWorkflowFocus =
  | "submission-review"
  | "ai-results"
  | "integrity-review"
  | "release-follow-up";

export interface LecturerWorkflowNotificationDestination {
  focus: LecturerAssignmentWorkflowFocus;
  targetNotification: CommunicationMessage;
  redirected: boolean;
}

const getLecturerNotificationFocus = (
  category: CommunicationMessage["category"],
): LecturerAssignmentWorkflowFocus | null => {
  switch (category) {
    case "submission-received":
      return "submission-review";
    case "ai-grading-ready":
      return "ai-results";
    case "integrity-check-ready":
      return "integrity-review";
    case "grade-released":
      return "release-follow-up";
    case "intervention-overdue-reminder":
      return "release-follow-up";
    default:
      return null;
  }
};

const getLecturerNotificationStageRank = (
  focus: LecturerAssignmentWorkflowFocus,
) => {
  switch (focus) {
    case "submission-review":
      return 1;
    case "ai-results":
      return 2;
    case "integrity-review":
      return 3;
    case "release-follow-up":
      return 4;
  }
};

export const getLecturerWorkflowNotificationDestination = ({
  notification,
  notifications,
}: {
  notification: CommunicationMessage;
  notifications: CommunicationMessage[];
}): LecturerWorkflowNotificationDestination | null => {
  const clickedFocus = getLecturerNotificationFocus(notification.category);
  if (!clickedFocus || !notification.relatedAssignmentId) {
    return null;
  }

  const assignmentNotifications = notifications
    .filter((candidate) => candidate.relatedAssignmentId === notification.relatedAssignmentId)
    .map((candidate) => ({
      notification: candidate,
      focus: getLecturerNotificationFocus(candidate.category),
    }))
    .filter(
      (
        candidate,
      ): candidate is { notification: CommunicationMessage; focus: LecturerAssignmentWorkflowFocus } =>
        candidate.focus !== null,
    )
    .sort((left, right) => {
      const rankDelta =
        getLecturerNotificationStageRank(right.focus) - getLecturerNotificationStageRank(left.focus);
      if (rankDelta !== 0) return rankDelta;

      return new Date(right.notification.createdAt).getTime() - new Date(left.notification.createdAt).getTime();
    });

  const latest = assignmentNotifications[0];
  if (!latest) {
    return {
      focus: clickedFocus,
      targetNotification: notification,
      redirected: false,
    };
  }

  return {
    focus: latest.focus,
    targetNotification: latest.notification,
    redirected: latest.notification.id !== notification.id,
  };
};

export const getLecturerWorkflowNotificationPreviewHint = ({
  notification,
  notifications,
}: {
  notification: CommunicationMessage;
  notifications: CommunicationMessage[];
}) => {
  if (notification.category === "intervention-overdue-reminder") {
    return "Opens the student support record for overdue intervention follow-up.";
  }

  const destination = getLecturerWorkflowNotificationDestination({
    notification,
    notifications,
  });

  const effectiveFocus = destination?.focus ?? getLecturerNotificationFocus(notification.category);

  switch (effectiveFocus) {
    case "submission-review":
      return destination?.redirected
        ? "A newer workflow update exists. Opens the latest assignment review state."
        : "Opens the assignment workflow for review.";
    case "ai-results":
      return destination?.redirected
        ? "A newer workflow update exists. Opens the latest grading-result state."
        : "Opens the assignment workflow to inspect grading results.";
    case "integrity-review":
      return destination?.redirected
        ? "A newer workflow update exists. Opens the latest integrity-review state."
        : "Opens the assignment workflow to review integrity evidence.";
    case "release-follow-up":
      return destination?.redirected
        ? "A newer workflow update exists. Opens the latest release-follow-up state."
        : "Opens the assignment workflow for released-grade follow-up.";
    default:
      return null;
  }
};
