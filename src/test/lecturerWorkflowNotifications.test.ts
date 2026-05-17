import { describe, expect, it } from "vitest";

import type { CommunicationMessage } from "@/lib/communications";
import {
  getLecturerWorkflowNotificationDestination,
  getLecturerWorkflowNotificationPreviewHint,
} from "@/lib/lecturerWorkflowNotifications";

const buildNotification = (
  id: string,
  category: CommunicationMessage["category"],
  createdAt: string,
): CommunicationMessage => ({
  id,
  createdAt,
  cleared: false,
  read: false,
  category,
  recipientName: "Dr. Lecturer",
  recipientEmail: "lecturer@example.com",
  recipientId: "lecturer-1",
  subject: category,
  body: category,
  relatedAssignmentId: "assignment-1",
});

describe("lecturer workflow notifications", () => {
  it("redirects an older AI grading notice to the newer release follow-up state", () => {
    const aiReady = buildNotification("ai-1", "ai-grading-ready", "2026-05-03T09:00:00.000Z");
    const released = buildNotification("release-1", "grade-released", "2026-05-03T10:00:00.000Z");

    const result = getLecturerWorkflowNotificationDestination({
      notification: aiReady,
      notifications: [aiReady, released],
    });

    expect(result).toMatchObject({
      focus: "release-follow-up",
      redirected: true,
      targetNotification: {
        id: "release-1",
      },
    });
  });

  it("keeps the clicked notice when it is already the latest relevant assignment state", () => {
    const integrityReady = buildNotification("integrity-1", "integrity-check-ready", "2026-05-03T10:00:00.000Z");

    const result = getLecturerWorkflowNotificationDestination({
      notification: integrityReady,
      notifications: [integrityReady],
    });

    expect(result).toMatchObject({
      focus: "integrity-review",
      redirected: false,
      targetNotification: {
        id: "integrity-1",
      },
    });
  });

  it("surfaces a latest-state preview hint when a newer assignment workflow notice exists", () => {
    const submission = buildNotification("submission-1", "submission-received", "2026-05-03T08:00:00.000Z");
    const integrity = buildNotification("integrity-1", "integrity-check-ready", "2026-05-03T09:00:00.000Z");

    const hint = getLecturerWorkflowNotificationPreviewHint({
      notification: submission,
      notifications: [submission, integrity],
    });

    expect(hint).toBe("A newer workflow update exists. Opens the latest integrity-review state.");
  });
});
