import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, fromMock, logger } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  fromMock: vi.fn(),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
    from: fromMock,
  },
}));

vi.mock("@/lib/logger", () => ({
  log: logger,
}));

import { getVisibleCommunicationMessages, loadVisibleCommunicationMessages } from "@/lib/communications";

const createQuery = (result: { data: unknown; error: unknown }) => {
  const query: Record<string, unknown> = {
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    then: (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve),
  };

  return query;
};

describe("communications load and visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: "test-access-token",
        },
      },
    });
  });

  it("matches visible messages by normalized email and name while hiding cleared messages", () => {
    const visible = getVisibleCommunicationMessages(
      [
        {
          id: "message-1",
          createdAt: "2026-05-01T10:00:00.000Z",
          cleared: false,
          read: false,
          category: "grade-released",
          recipientName: "Dr. Ada Lecturer",
          recipientEmail: "lecturer@example.edu",
          recipientId: "lecturer-1",
          subject: "Feedback released",
          body: "Your released result is now available",
        },
        {
          id: "message-2",
          createdAt: "2026-05-01T11:00:00.000Z",
          cleared: true,
          read: false,
          category: "grade-released",
          recipientName: "Dr. Ada Lecturer",
          recipientEmail: "lecturer@example.edu",
          recipientId: "lecturer-1",
          subject: "Feedback released",
          body: "Your released result is now available",
        },
      ],
      {
        email: "LECTURER@EXAMPLE.EDU",
        fullName: "Dr. Ada Lecturer",
      },
    );

    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe("message-1");
  });

  it("loads visible communication messages from the full schema path", async () => {
    fromMock.mockReturnValue({
      select: vi.fn(() =>
        createQuery({
          data: [
            {
              id: "message-1",
              created_at: "2026-05-01T10:00:00.000Z",
              cleared: false,
              read: false,
              category: "grade-released",
              recipient_name: "Dr. Ada Lecturer",
              recipient_email: "lecturer@example.edu",
              recipient_id: "lecturer-1",
              subject: "Feedback released",
              body: "Your released result is now available",
              related_student_id: "student-1",
              related_assignment_id: "assignment-1",
            },
            {
              id: "message-2",
              created_at: "2026-05-01T11:00:00.000Z",
              cleared: true,
              read: false,
              category: "grade-released",
              recipient_name: "Dr. Ada Lecturer",
              recipient_email: "lecturer@example.edu",
              recipient_id: "lecturer-1",
              subject: "Feedback released",
              body: "Your released result is now available",
              related_student_id: "student-1",
              related_assignment_id: "assignment-1",
            },
          ],
          error: null,
        }),
      ),
    });

    const messages = await loadVisibleCommunicationMessages({
      userId: "lecturer-1",
      email: "lecturer@example.edu",
      fullName: "Dr. Ada Lecturer",
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: "message-1",
      read: false,
      cleared: false,
      recipientId: "lecturer-1",
      relatedStudentId: "student-1",
      relatedAssignmentId: "assignment-1",
    });
  });

  it("falls back to the compatibility schema when the read column is missing", async () => {
    const selectResponses = [
      {
        data: null,
        error: {
          code: "42703",
          message: 'column "read" does not exist',
          details: "read",
          hint: null,
        },
      },
      {
        data: [
          {
            id: "message-1",
            created_at: "2026-05-01T10:00:00.000Z",
            cleared: false,
            category: "grade-released",
            recipient_name: "Dr. Ada Lecturer",
            recipient_email: "lecturer@example.edu",
            recipient_id: "lecturer-1",
            subject: "Feedback released",
            body: "Your released result is now available",
            related_student_id: "student-1",
            related_assignment_id: "assignment-1",
          },
        ],
        error: null,
      },
    ];
    let selectCall = 0;
    fromMock.mockReturnValue({
      select: vi.fn(() => {
        const result = selectResponses[selectCall++] ?? selectResponses[selectResponses.length - 1];
        return createQuery(result);
      }),
    });

    const messages = await loadVisibleCommunicationMessages({
      userId: "lecturer-1",
      email: "lecturer@example.edu",
      fullName: "Dr. Ada Lecturer",
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: "message-1",
      read: false,
      cleared: false,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("returns an empty list when the browser session is missing", async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: null,
      },
    });

    await expect(loadVisibleCommunicationMessages({ userId: "lecturer-1" })).resolves.toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
