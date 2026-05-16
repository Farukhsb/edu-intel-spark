import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateEqMock = vi.fn();
const updateSelectMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: updateMock,
    })),
  },
}));

vi.mock("@/lib/logger", () => ({
  log: {
    error: vi.fn(),
  },
}));

import {
  buildAssignmentPublishedNotification,
  buildAIGradingReadyNotification,
  buildGradeReleasedNotification,
  buildIntegrityCheckReadyNotification,
  buildSubmissionReceivedNotification,
  clearCommunicationMessage,
  getVisibleCommunicationMessages,
  markCommunicationMessageRead,
} from "@/lib/communications";

beforeEach(() => {
  updateEqMock.mockReset();
  updateSelectMock.mockReset();
  updateMock.mockReset();

  updateEqMock.mockReturnValue({
    select: updateSelectMock,
  });

  updateSelectMock.mockReturnValue({
    single: vi.fn().mockResolvedValue({
      data: {
        id: "message-1",
        created_at: "2026-04-27T10:00:00.000Z",
        cleared: false,
        read: true,
        category: "ai-grading-ready",
        recipient_name: "Lecturer",
        recipient_email: null,
        recipient_id: "lecturer-1",
        subject: "AI grading ready",
        body: "AI grading is ready for Algorithms Essay",
        related_student_id: null,
        related_assignment_id: "assignment-1",
      },
      error: null,
    }),
  });

  updateMock.mockReturnValue({
    eq: updateEqMock,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("workflow notifications", () => {
  it("builds a safe lecturer notification for student submissions", () => {
    const notification = buildSubmissionReceivedNotification({
      lecturerId: "lecturer-1",
      assignmentId: "assignment-1",
      assignmentTitle: "Algorithms Essay",
      studentName: "Sam Student",
    });

    expect(notification).toEqual({
      category: "submission-received",
      recipientName: "Lecturer",
      recipientEmail: null,
      recipientId: "lecturer-1",
      subject: "New submission received",
      body: "Sam Student submitted Algorithms Essay",
      relatedAssignmentId: "assignment-1",
    });
  });

  it("builds a safe lecturer notification when AI grading completes", () => {
    const notification = buildAIGradingReadyNotification({
      lecturerId: "lecturer-1",
      assignmentId: "assignment-1",
      assignmentTitle: "Algorithms Essay",
    });

    expect(notification).toEqual({
      category: "ai-grading-ready",
      recipientName: "Lecturer",
      recipientEmail: null,
      recipientId: "lecturer-1",
      subject: "AI grading ready",
      body: "AI grading is ready for Algorithms Essay",
      relatedAssignmentId: "assignment-1",
    });
  });

  it("builds a safe lecturer notification when integrity review completes", () => {
    const notification = buildIntegrityCheckReadyNotification({
      lecturerId: "lecturer-1",
      assignmentId: "assignment-1",
      assignmentTitle: "Algorithms Essay",
    });

    expect(notification).toEqual({
      category: "integrity-check-ready",
      recipientName: "Lecturer",
      recipientEmail: null,
      recipientId: "lecturer-1",
      subject: "Integrity check ready",
      body: "Integrity review is ready for Algorithms Essay",
      relatedAssignmentId: "assignment-1",
    });
    expect(notification.body).not.toMatch(/score|similarity|plagiarism|overlap|submission/i);
  });

  it("builds a safe student notification when feedback is released", () => {
    const notification = buildGradeReleasedNotification({
      studentName: "Sam Student",
      studentEmail: "sam@student.test",
      studentId: "student-1",
      assignmentId: "assignment-1",
      assignmentTitle: "Algorithms Essay",
    });

    expect(notification).toEqual({
      category: "grade-released",
      recipientName: "Sam Student",
      recipientEmail: "sam@student.test",
      recipientId: "student-1",
      subject: "Feedback released",
      body: "Your released result for Algorithms Essay is now available",
      relatedAssignmentId: "assignment-1",
      relatedStudentId: "student-1",
    });
    expect(notification.body).not.toMatch(/70|score|feedback:/i);
  });

  it("builds a safe student notification when an assignment is published", () => {
    const notification = buildAssignmentPublishedNotification({
      studentName: "Sam Student",
      studentEmail: "sam@student.test",
      studentId: "student-1",
      assignmentId: "assignment-1",
      assignmentTitle: "Algorithms Essay",
    });

    expect(notification).toEqual({
      category: "assignment-published",
      recipientName: "Sam Student",
      recipientEmail: "sam@student.test",
      recipientId: "student-1",
      subject: "Assignment published",
      body: "Algorithms Essay is now available in GradeAI.",
      relatedAssignmentId: "assignment-1",
      relatedStudentId: "student-1",
    });
    expect(notification.body).not.toMatch(/score|feedback|plagiarism|similarity/i);
  });

  it("keeps lecturer workflow notifications visible in the bell for the matching recipient id", () => {
    const visible = getVisibleCommunicationMessages(
      [
        {
          id: "message-1",
          createdAt: "2026-04-27T10:00:00.000Z",
          cleared: false,
          read: false,
          category: "ai-grading-ready",
          recipientName: "Lecturer",
          recipientEmail: null,
          recipientId: "lecturer-1",
          subject: "AI grading ready",
          body: "AI grading is ready for Algorithms Essay",
          relatedAssignmentId: "assignment-1",
        },
      ],
      {
        userId: "lecturer-1",
        email: "lecturer@gradeai.test",
        fullName: "Dr. Ada Lecturer",
      },
    );

    expect(visible).toHaveLength(1);
    expect(visible[0].subject).toBe("AI grading ready");
    expect(visible[0].cleared).toBe(false);
    expect(visible[0].read).toBe(false);
  });

  it("marks a notification as read without changing its safe body", async () => {
    const dispatchedEvents: string[] = [];
    const dispatchSpy = vi
      .spyOn(window, "dispatchEvent")
      .mockImplementation((event: Event) => {
        dispatchedEvents.push(event.type);
        return true;
      });

    const updated = await markCommunicationMessageRead("message-1");

    expect(updateMock).toHaveBeenCalledWith({ read: true });
    expect(updateEqMock).toHaveBeenCalledWith("id", "message-1");
    expect(updated).toMatchObject({
      id: "message-1",
      cleared: false,
      read: true,
      subject: "AI grading ready",
      body: "AI grading is ready for Algorithms Essay",
    });
    expect(dispatchedEvents).toContain("gradeai:communications-updated");
    dispatchSpy.mockRestore();
  });

  it("clears a notification from the bell without deleting it", async () => {
    updateSelectMock.mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          id: "message-1",
          created_at: "2026-04-27T10:00:00.000Z",
          cleared: true,
          read: true,
          category: "ai-grading-ready",
          recipient_name: "Lecturer",
          recipient_email: null,
          recipient_id: "lecturer-1",
          subject: "AI grading ready",
          body: "AI grading is ready for Algorithms Essay",
          related_student_id: null,
          related_assignment_id: "assignment-1",
        },
        error: null,
      }),
    });

    const updated = await clearCommunicationMessage("message-1");

    expect(updateMock).toHaveBeenCalledWith({ cleared: true });
    expect(updated).toMatchObject({
      id: "message-1",
      cleared: true,
      read: true,
      subject: "AI grading ready",
    });
  });

  it("clears a notification with a compatibility retry when the read column is missing", async () => {
    updateSelectMock
      .mockReturnValueOnce({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: {
            code: "42703",
            message: 'column "read" does not exist',
            details: null,
            hint: null,
          },
        }),
      })
      .mockReturnValueOnce({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "message-1",
            created_at: "2026-04-27T10:00:00.000Z",
            cleared: true,
            category: "ai-grading-ready",
            recipient_name: "Lecturer",
            recipient_email: null,
            recipient_id: "lecturer-1",
            subject: "AI grading ready",
            body: "AI grading is ready for Algorithms Essay",
            related_student_id: null,
            related_assignment_id: "assignment-1",
          },
          error: null,
        }),
      });

    const updated = await clearCommunicationMessage("message-1");

    expect(updateMock).toHaveBeenCalledWith({ cleared: true });
    expect(updated).toMatchObject({
      id: "message-1",
      cleared: true,
      read: false,
      subject: "AI grading ready",
    });
  });

  it("hides cleared notifications from the visible bell list", () => {
    const visible = getVisibleCommunicationMessages(
      [
        {
          id: "message-1",
          createdAt: "2026-04-27T10:00:00.000Z",
          cleared: true,
          read: true,
          category: "ai-grading-ready",
          recipientName: "Lecturer",
          recipientEmail: null,
          recipientId: "lecturer-1",
          subject: "AI grading ready",
          body: "AI grading is ready for Algorithms Essay",
          relatedAssignmentId: "assignment-1",
        },
      ],
      {
        userId: "lecturer-1",
      },
    );

    expect(visible).toHaveLength(0);
  });
});
