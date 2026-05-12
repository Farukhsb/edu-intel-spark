import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  from: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock("@/lib/logger", () => ({
  log: {
    warn: mocks.warn,
  },
}));

describe("academic access event logging", () => {
  beforeEach(() => {
    mocks.insert.mockReset();
    mocks.from.mockReset();
    mocks.warn.mockReset();
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({
      insert: mocks.insert,
    });
  });

  it("inserts a non-blocking academic access event for the current actor", async () => {
    const { logAcademicAccessEvent } = await import("@/lib/audit/academicAccessEvents");

    await logAcademicAccessEvent({
      actorId: "lecturer-1",
      actorRole: "lecturer",
      eventType: "submission_viewed",
      resourceType: "submission",
      resourceId: "submission-1",
      assignmentId: "assignment-1",
      submissionId: "submission-1",
      metadata: {
        source: "assignment_review_dialog",
        ignored: undefined,
      },
    });

    expect(mocks.from).toHaveBeenCalledWith("academic_access_events");
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: "lecturer-1",
        actor_role: "lecturer",
        event_type: "submission_viewed",
        resource_type: "submission",
        resource_id: "submission-1",
        assignment_id: "assignment-1",
        submission_id: "submission-1",
        metadata: {
          source: "assignment_review_dialog",
        },
      }),
    );
  });

  it("returns quietly when actor context is missing", async () => {
    const { logAcademicAccessEvent } = await import("@/lib/audit/academicAccessEvents");

    await logAcademicAccessEvent({
      actorId: null,
      actorRole: "lecturer",
      eventType: "submission_viewed",
      resourceType: "submission",
    });

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("logs a warning instead of throwing when the insert fails", async () => {
    mocks.insert.mockResolvedValue({
      error: new Error("insert failed"),
    });

    const { logAcademicAccessEvent } = await import("@/lib/audit/academicAccessEvents");

    await expect(
      logAcademicAccessEvent({
        actorId: "lecturer-1",
        actorRole: "lecturer",
        eventType: "grade_details_viewed",
        resourceType: "grade",
        resourceId: "grade-1",
      }),
    ).resolves.toBeUndefined();

    expect(mocks.warn).toHaveBeenCalledWith(
      "Failed to record academic access event",
      expect.objectContaining({
        eventType: "grade_details_viewed",
        resourceType: "grade",
      }),
    );
  });
});
