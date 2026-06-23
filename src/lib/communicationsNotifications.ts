import type { DraftCommunicationMessage } from "@/lib/communicationsHelpers";

export const buildSubmissionReceivedNotification = (input: {
  lecturerId: string;
  assignmentId: string;
  assignmentTitle: string;
  studentName: string;
}): DraftCommunicationMessage => ({
  category: "submission-received",
  recipientName: "Lecturer",
  recipientEmail: null,
  recipientId: input.lecturerId,
  subject: "New submission received",
  body: `${input.studentName} submitted ${input.assignmentTitle}`,
  relatedAssignmentId: input.assignmentId,
});

export const buildAIGradingReadyNotification = (input: {
  lecturerId: string;
  assignmentId: string;
  assignmentTitle: string;
}): DraftCommunicationMessage => ({
  category: "ai-grading-ready",
  recipientName: "Lecturer",
  recipientEmail: null,
  recipientId: input.lecturerId,
  subject: "AI grading ready",
  body: `AI grading is ready for ${input.assignmentTitle}`,
  relatedAssignmentId: input.assignmentId,
});

export const buildIntegrityCheckReadyNotification = (input: {
  lecturerId: string;
  assignmentId: string;
  assignmentTitle: string;
}): DraftCommunicationMessage => ({
  category: "integrity-check-ready",
  recipientName: "Lecturer",
  recipientEmail: null,
  recipientId: input.lecturerId,
  subject: "Integrity check ready",
  body: `Integrity review is ready for ${input.assignmentTitle}`,
  relatedAssignmentId: input.assignmentId,
});

export const buildGradeReleasedNotification = (input: {
  studentName: string;
  studentEmail: string | null;
  studentId?: string;
  assignmentId: string;
  assignmentTitle: string;
}): DraftCommunicationMessage => ({
  category: "grade-released",
  recipientName: input.studentName,
  recipientEmail: input.studentEmail,
  recipientId: input.studentId,
  subject: "Feedback released",
  body: `Your released result for ${input.assignmentTitle} is now available`,
  relatedAssignmentId: input.assignmentId,
  relatedStudentId: input.studentId,
});

export const buildAssignmentPublishedNotification = (input: {
  studentName: string;
  studentEmail: string | null;
  studentId?: string;
  assignmentId: string;
  assignmentTitle: string;
}): DraftCommunicationMessage => ({
  category: "assignment-published",
  recipientName: input.studentName,
  recipientEmail: input.studentEmail,
  recipientId: input.studentId,
  subject: "Assignment published",
  body: `${input.assignmentTitle} is now available in GradeAI.`,
  relatedAssignmentId: input.assignmentId,
  relatedStudentId: input.studentId,
});
