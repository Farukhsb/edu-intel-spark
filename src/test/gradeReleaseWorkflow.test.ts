import { describe, expect, it, vi } from "vitest";

import { executeGradeRelease, summarizeGradeReleaseBatch } from "@/lib/gradeReleaseWorkflow";

describe("grade release workflow", () => {
  it("stops the release workflow when the status update fails", async () => {
    const markReleased = vi.fn().mockRejectedValue(new Error("update failed"));
    const logAudit = vi.fn();
    const queueNotification = vi.fn();
    const sendEmail = vi.fn();

    const result = await executeGradeRelease({
      submissionId: "submission-1",
      markReleased,
      logAudit,
      queueNotification,
      sendEmail,
    });

    expect(result).toEqual({
      submissionId: "submission-1",
      released: false,
      auditLogged: false,
      notificationSaved: false,
      emailQueued: false,
    });
    expect(logAudit).not.toHaveBeenCalled();
    expect(queueNotification).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("summarizes partial release follow-up failures after a successful status transition", async () => {
    const results = [
      await executeGradeRelease({
        submissionId: "submission-1",
        markReleased: vi.fn().mockResolvedValue(undefined),
        logAudit: vi.fn().mockResolvedValue(true),
        queueNotification: vi.fn().mockResolvedValue(false),
        sendEmail: vi.fn().mockResolvedValue(true),
      }),
      await executeGradeRelease({
        submissionId: "submission-2",
        markReleased: vi.fn().mockResolvedValue(undefined),
        logAudit: vi.fn().mockResolvedValue(false),
        queueNotification: vi.fn().mockResolvedValue(true),
        sendEmail: vi.fn().mockResolvedValue(false),
      }),
    ];

    expect(summarizeGradeReleaseBatch(results)).toEqual({
      releasedCount: 2,
      updateFailureCount: 0,
      auditFailureCount: 1,
      notificationFailureCount: 1,
      emailFailureCount: 1,
    });
  });
});
