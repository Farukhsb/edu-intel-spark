import type React from "react";

import { Badge } from "@/components/ui/badge";
import { safeFormatDate } from "@/lib/date";
import { type CommunicationMessage } from "@/lib/communications";
import { getLecturerWorkflowNotificationPreviewHint } from "@/lib/lecturerWorkflowNotifications";
import { cn } from "@/lib/utils";

type Props = {
  notifications: CommunicationMessage[];
  unreadCount: number;
  isStudent: boolean;
  onOpenNotification: (notification: CommunicationMessage) => void;
  onClearNotification: (
    event: React.MouseEvent<HTMLButtonElement>,
    notification: CommunicationMessage
  ) => void;
};

const getNotificationCategoryLabel = (category: CommunicationMessage["category"]) => {
  switch (category) {
    case "grade-released":
      return "Released result";
    case "feedback-summary":
      return "Feedback";
    case "assignment-published":
      return "Assignment";
    case "submission-received":
      return "Submission";
    case "ai-grading-ready":
      return "AI grading";
    case "integrity-check-ready":
      return "Integrity";
    case "at-risk-alert":
      return "At-risk";
    case "intervention-follow-up":
      return "Support";
    default:
      return "Notice";
  }
};

const getStudentNotificationPreviewHint = (notification: CommunicationMessage) => {
  switch (notification.category) {
    case "grade-released":
      return "Opens your released result and grade explanation.";
    case "feedback-summary":
      return "Opens your released result summary.";
    case "assignment-published":
      return "Opens the assignment submission window.";
    case "at-risk-alert":
    case "intervention-follow-up":
      return "Opens your released result and grade explanation.";
    default:
      return null;
  }
};

export const NotificationDropdown = ({
  notifications,
  unreadCount,
  isStudent,
  onOpenNotification,
  onClearNotification,
}: Props) => (
  <div className="absolute right-4 top-16 z-50 w-80 rounded-2xl border bg-card shadow-xl">
    <div className="border-b p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Notifications</p>
        {unreadCount > 0 && <Badge variant="secondary">{unreadCount}</Badge>}
      </div>
    </div>
    {notifications.length === 0 ? (
      <p className="p-4 text-center text-xs text-muted-foreground">No new notifications</p>
    ) : (
      <div className="max-h-80 overflow-y-auto p-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={cn(
              "rounded-xl text-left text-xs",
              notification.read ? "opacity-75" : "bg-muted/25",
            )}
          >
            <button
              type="button"
              onClick={() => onOpenNotification(notification)}
              className="block w-full rounded-xl p-3 text-left text-xs hover:bg-muted/40"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {!notification.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  <span className="truncate font-medium">{notification.subject}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {safeFormatDate(notification.createdAt, "MMM d, HH:mm")}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {getNotificationCategoryLabel(notification.category)}
                </Badge>
              </div>
              <p className="mt-1 text-muted-foreground">{notification.recipientName}</p>
              <p className="mt-1 line-clamp-2 text-muted-foreground">{notification.body}</p>
              {isStudent && getStudentNotificationPreviewHint(notification) && (
                <p className="mt-2 text-[11px] font-medium text-foreground/80">
                  {getStudentNotificationPreviewHint(notification)}
                </p>
              )}
              {!isStudent && getLecturerWorkflowNotificationPreviewHint({
                notification,
                notifications,
              }) && (
                <p className="mt-2 text-[11px] font-medium text-foreground/80">
                  {getLecturerWorkflowNotificationPreviewHint({
                    notification,
                    notifications,
                  })}
                </p>
              )}
            </button>
            <div className="flex justify-end px-3 pb-3">
              <button
                type="button"
                onClick={(event) => onClearNotification(event, notification)}
                className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);
