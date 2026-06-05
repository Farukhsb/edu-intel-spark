import { describe, expect, it } from "vitest";

import type { CommunicationMessage } from "@/lib/communications";
import { getStudentSupportNotificationDestination } from "@/lib/studentSupportWorkflow";

const baseSupportNotice: CommunicationMessage = {
  id: "support-1",
  createdAt: "2026-05-01T09:00:00.000Z",
  cleared: false,
  read: false,
  category: "intervention-follow-up",
  recipientName: "Student",
  recipientEmail: "student@example.com",
  recipientId: "student-1",
  subject: "Study plan reminder",
  body: "Review your support plan.",
  relatedStudentId: "student-1",
};

describe("student support workflow routing", () => {
  it("prefers a newer released-result notice over the older support notice", () => {
    const result = getStudentSupportNotificationDestination({
      notification: baseSupportNotice,
      notifications: [
        baseSupportNotice,
        {
          ...baseSupportNotice,
          id: "released-1",
          createdAt: "2026-05-02T10:00:00.000Z",
          category: "grade-released",
          subject: "Feedback released",
          body: "Your released result is ready.",
          relatedAssignmentId: "assignment-1",
        },
      ],
    });

    expect(result).toMatchObject({
      kind: "released-result",
      targetNotification: {
        id: "released-1",
      },
    });
  });

  it("falls back to a newer assignment-published notice when no released result is newer", () => {
    const result = getStudentSupportNotificationDestination({
      notification: baseSupportNotice,
      notifications: [
        baseSupportNotice,
        {
          ...baseSupportNotice,
          id: "assignment-1",
          createdAt: "2026-05-02T10:00:00.000Z",
          category: "assignment-published",
          subject: "Assignment published",
          body: "A new assignment is available.",
          relatedAssignmentId: "assignment-2",
        },
      ],
    });

    expect(result).toMatchObject({
      kind: "assignments",
      targetNotification: {
        id: "assignment-1",
      },
    });
  });

  it("falls back to released-result guidance when no newer academic notice exists", () => {
    const result = getStudentSupportNotificationDestination({
      notification: baseSupportNotice,
      notifications: [baseSupportNotice],
    });

    expect(result).toEqual({
      kind: "released-result",
      targetNotification: null,
    });
  });
});
