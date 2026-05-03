import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const limit = vi.fn();
  const eq = vi.fn();
  const is = vi.fn();
  const insertSelectSingle = vi.fn();
  const insertSelect = vi.fn();
  const insert = vi.fn();
  const from = vi.fn();

  return {
    auth: {
      getUser: vi.fn(),
    },
    limit,
    eq,
    is,
    insertSelectSingle,
    insertSelect,
    insert,
    from,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: mocks.auth,
    from: mocks.from,
  },
}));

vi.mock("@/lib/logger", () => ({
  log: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  buildCommunicationMessageFingerprint,
  dispatchCommunicationMessage,
  queueCommunicationMessage,
} from "@/lib/communications";

describe("communication message dedupe", () => {
  beforeEach(() => {
    mocks.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: "lecturer-1",
        },
      },
    });

    mocks.limit.mockResolvedValue({
      data: [],
      error: null,
    });
    const query = {
      eq: mocks.eq,
      is: mocks.is,
      limit: mocks.limit,
    };
    mocks.eq.mockReturnValue(query);
    mocks.is.mockReturnValue(query);
    mocks.insertSelectSingle.mockResolvedValue({
      data: {
        id: "message-1",
        created_at: "2026-05-03T10:00:00.000Z",
        cleared: false,
        read: false,
        category: "grade-released",
        recipient_name: "Sam Student",
        recipient_email: "sam@student.test",
        recipient_id: "student-1",
        subject: "Feedback released",
        body: "Your released result for Algorithms Essay is now available",
        related_student_id: "student-1",
        related_assignment_id: "assignment-1",
      },
      error: null,
    });
    mocks.insertSelect.mockReturnValue({
      single: mocks.insertSelectSingle,
    });
    mocks.insert.mockReturnValue({
      select: mocks.insertSelect,
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === "communication_messages") {
        return {
          select: () => query,
          insert: mocks.insert,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("builds a stable fingerprint for exact-repeat workflow messages", () => {
    expect(
      buildCommunicationMessageFingerprint({
        category: "grade-released",
        recipientName: "Sam Student",
        recipientEmail: "sam@student.test",
        recipientId: "student-1",
        subject: "Feedback released",
        body: "Your released result for Algorithms Essay is now available",
        relatedStudentId: "student-1",
        relatedAssignmentId: "assignment-1",
      }),
    ).toBe(
      "grade-released|sam student|sam@student.test|student-1|feedback released|your released result for algorithms essay is now available|student-1|assignment-1",
    );
  });

  it("returns the existing communication message instead of inserting an exact duplicate", async () => {
    mocks.limit.mockResolvedValueOnce({
      data: [
        {
          id: "message-existing",
          created_at: "2026-05-03T09:00:00.000Z",
          cleared: false,
          read: false,
          category: "grade-released",
          recipient_name: "Sam Student",
          recipient_email: "sam@student.test",
          recipient_id: "student-1",
          subject: "Feedback released",
          body: "Your released result for Algorithms Essay is now available",
          related_student_id: "student-1",
          related_assignment_id: "assignment-1",
        },
      ],
      error: null,
    });

    const result = await queueCommunicationMessage({
      category: "grade-released",
      recipientName: "Sam Student",
      recipientEmail: "sam@student.test",
      recipientId: "student-1",
      subject: "Feedback released",
      body: "Your released result for Algorithms Essay is now available",
      relatedStudentId: "student-1",
      relatedAssignmentId: "assignment-1",
    });

    expect(result).toMatchObject({
      id: "message-existing",
      subject: "Feedback released",
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("reports duplicate status when an exact-repeat workflow message already exists", async () => {
    mocks.limit.mockResolvedValueOnce({
      data: [
        {
          id: "message-existing",
          created_at: "2026-05-03T09:00:00.000Z",
          cleared: false,
          read: false,
          category: "grade-released",
          recipient_name: "Sam Student",
          recipient_email: "sam@student.test",
          recipient_id: "student-1",
          subject: "Feedback released",
          body: "Your released result for Algorithms Essay is now available",
          related_student_id: "student-1",
          related_assignment_id: "assignment-1",
        },
      ],
      error: null,
    });

    const result = await dispatchCommunicationMessage({
      category: "grade-released",
      recipientName: "Sam Student",
      recipientEmail: "sam@student.test",
      recipientId: "student-1",
      subject: "Feedback released",
      body: "Your released result for Algorithms Essay is now available",
      relatedStudentId: "student-1",
      relatedAssignmentId: "assignment-1",
    });

    expect(result).toMatchObject({
      ok: true,
      status: "duplicate",
      message: {
        id: "message-existing",
      },
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
