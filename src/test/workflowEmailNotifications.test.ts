import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock, warnMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  warnMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  log: {
    warn: warnMock,
  },
}));

import {
  formatAssignmentPublishedEmail,
  formatGradeReleasedEmail,
  formatSubmissionNotificationEmail,
} from "../../supabase/functions/_shared/email";
import {
  WorkflowEmailRequestSchema,
  sendWorkflowNotificationEmail,
} from "@/lib/communications";

const forbiddenContentPattern = /score|feedback text|private feedback|plagiarism|similarity|submission text|ai prompt|ai output/i;

describe("workflow email notifications", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    warnMock.mockReset();
  });

  it("keeps assignment-published email content safe", () => {
    const email = formatAssignmentPublishedEmail({
      studentName: "Sam Student",
      assignmentTitle: "Algorithms Essay",
      dueDate: "2026-05-01T10:00:00.000Z",
      assignmentUrl: "https://gradeai.test/dashboard/assignments/assignment-1",
    });

    expect(email.subject).toBe("New assignment published");
    expect(email.text).toContain("Algorithms Essay");
    expect(email.text).toContain("https://gradeai.test/dashboard/assignments/assignment-1");
    expect(email.text).not.toMatch(forbiddenContentPattern);
    expect(email.html).not.toMatch(forbiddenContentPattern);
  });

  it("keeps grade-released email content safe", () => {
    const email = formatGradeReleasedEmail({
      studentName: "Sam Student",
      assignmentTitle: "Algorithms Essay",
      assignmentUrl: "https://gradeai.test/dashboard/assignments/assignment-1",
    });

    expect(email.subject).toBe("Feedback released");
    expect(email.text).toContain("Algorithms Essay");
    expect(email.text).not.toMatch(forbiddenContentPattern);
    expect(email.html).not.toMatch(forbiddenContentPattern);
  });

  it("keeps submission-received email content safe", () => {
    const email = formatSubmissionNotificationEmail({
      lecturerName: "Dr Ada Lecturer",
      assignmentTitle: "Algorithms Essay",
      studentName: "Sam Student",
      submittedAt: "2026-05-01T10:00:00.000Z",
      reviewUrl: "https://gradeai.test/dashboard/assignments/assignment-1",
    });

    expect(email.subject).toBe("New submission received for Algorithms Essay");
    expect(email.text).not.toMatch(forbiddenContentPattern);
    expect(email.html).not.toMatch(forbiddenContentPattern);
  });

  it("requires submissionId for submission-received email requests", () => {
    const result = WorkflowEmailRequestSchema.safeParse({
      category: "submission-received",
      assignmentId: "6f951f5c-2665-48c8-b404-3ef9b6288882",
    });

    expect(result.success).toBe(false);
  });

  it("does not invoke the edge function when the email request is invalid", async () => {
    const sent = await sendWorkflowNotificationEmail({
      category: "submission-received",
      assignmentId: "6f951f5c-2665-48c8-b404-3ef9b6288882",
    } as never);

    expect(sent).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalled();
  });
});
