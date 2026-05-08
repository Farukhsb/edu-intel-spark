import { describe, expect, it } from "vitest";

import { getModerationReleaseHandoffState } from "@/pages/dashboard/assignment-detail/domain";
import type { AssignmentDetailSubmission } from "@/pages/dashboard/assignment-detail/types";

const buildSubmission = (
  id: string,
  status: AssignmentDetailSubmission["status"],
): AssignmentDetailSubmission => ({
  id,
  assignment_id: "assignment-1",
  student_name: "Student",
  student_email: "student@example.com",
  student_id: "student-1",
  file_name: "essay.pdf",
  file_type: "application/pdf",
  file_url: "student-1/assignment-1/essay.pdf",
  status,
  submitted_at: "2026-05-03T10:00:00.000Z",
  uploaded_by: "student-1",
});

describe("moderation release handoff", () => {
  it("focuses approved submissions when release-ready work still exists", () => {
    const result = getModerationReleaseHandoffState([
      buildSubmission("submission-approved", "approved"),
      buildSubmission("submission-released", "released"),
    ]);

    expect(result).toMatchObject({
      kind: "release-ready",
      statusFilter: "approved",
      selectedSubmissionIds: ["submission-approved"],
    });
  });

  it("falls forward to released submissions when the old moderation handoff is already complete", () => {
    const result = getModerationReleaseHandoffState([
      buildSubmission("submission-released", "released"),
    ]);

    expect(result).toMatchObject({
      kind: "released",
      statusFilter: "released",
      selectedSubmissionIds: ["submission-released"],
    });
  });

  it("keeps the old handoff explicit when no approved or released submissions remain", () => {
    const result = getModerationReleaseHandoffState([
      buildSubmission("submission-moderated", "moderated"),
    ]);

    expect(result).toMatchObject({
      kind: "empty",
      statusFilter: "approved",
      selectedSubmissionIds: [],
    });
  });
});
