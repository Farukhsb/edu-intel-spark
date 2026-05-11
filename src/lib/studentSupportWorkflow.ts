import type { CommunicationMessage } from "@/lib/communications";

type SupportNotificationCategory = "at-risk-alert" | "intervention-follow-up";

export interface StudentSupportNotificationDestination {
  kind: "improvement-plan" | "released-result" | "assignments";
  targetNotification: CommunicationMessage | null;
}

const isSupportNotification = (category: CommunicationMessage["category"]): category is SupportNotificationCategory =>
  category === "at-risk-alert" || category === "intervention-follow-up";

const isReleasedResultNotification = (category: CommunicationMessage["category"]) =>
  category === "grade-released" || category === "feedback-summary";

const isAssignmentPublishedNotification = (category: CommunicationMessage["category"]) =>
  category === "assignment-published";

export const getStudentSupportNotificationDestination = ({
  notification,
  notifications,
}: {
  notification: CommunicationMessage;
  notifications: CommunicationMessage[];
}): StudentSupportNotificationDestination => {
  if (!isSupportNotification(notification.category)) {
    return {
      kind: "improvement-plan",
      targetNotification: null,
    };
  }

  const supportNoticeTime = new Date(notification.createdAt).getTime();
  const newerNotifications = notifications
    .filter((candidate) => new Date(candidate.createdAt).getTime() > supportNoticeTime)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  const newerReleasedResult = newerNotifications.find((candidate) =>
    isReleasedResultNotification(candidate.category),
  );
  if (newerReleasedResult) {
    return {
      kind: "released-result",
      targetNotification: newerReleasedResult,
    };
  }

  const newerAssignmentPublished = newerNotifications.find((candidate) =>
    isAssignmentPublishedNotification(candidate.category),
  );
  if (newerAssignmentPublished) {
    return {
      kind: "assignments",
      targetNotification: newerAssignmentPublished,
    };
  }

  return {
    kind: "improvement-plan",
    targetNotification: null,
  };
};
