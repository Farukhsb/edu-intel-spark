import { describe, expect, it } from "vitest";

import {
  buildAIGradingReadyNotification,
  buildGradeReleasedNotification,
  buildIntegrityCheckReadyNotification,
  buildSubmissionReceivedNotification,
  getVisibleCommunicationMessages,
} from "@/lib/communications";

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
      body: "Your feedback for Algorithms Essay is now available",
      relatedAssignmentId: "assignment-1",
      relatedStudentId: "student-1",
    });
    expect(notification.body).not.toMatch(/70|score|feedback:/i);
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

  it("keeps lecturer workflow notifications visible in the bell for the matching recipient id", () => {
    const visible = getVisibleCommunicationMessages(
      [
        {
          id: "message-1",
          createdAt: "2026-04-27T10:00:00.000Z",
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
  });
});
