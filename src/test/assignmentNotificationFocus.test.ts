import { describe, expect, it } from "vitest";

import { getAssignmentNotificationFocusState } from "@/pages/dashboard/assignment-detail/domain";
import type { AssignmentDetailSubmission } from "@/pages/dashboard/assignment-detail/types";

const buildSubmission = (
  id: string,
  status: AssignmentDetailSubmission["status"],
): AssignmentDetailSubmission => ({
  id,
  assignment_id: "assignment-1",
  student_id: `student-${id}`,
  student_name: `Student ${id}`,
  student_email: `${id}@example.com`,
  file_name: `${id}.pdf`,
  file_type: "application/pdf",
  file_url: `https://example.com/${id}.pdf`,
  status,
  submitted_at: "2026-05-03T10:00:00.000Z",
});

describe("assignment notification focus", () => {
  it("keeps an older review notice on the review queue when review work still exists", () => {
    const state = getAssignmentNotificationFocusState("submission-review", [
      buildSubmission("released-1", "released"),
      buildSubmission("submitted-1", "submitted"),
    ]);

    expect(state).toMatchObject({
      resolvedFocus: "submission-review",
      redirected: false,
      statusFilter: "submitted",
      selectedSubmissionIds: ["submitted-1"],
      visibleSubmissionIds: ["submitted-1"],
      title: "Opened from submission workflow notice",
    });
  });

  it("still falls forward to released results when released is the only terminal state", () => {
    const state = getAssignmentNotificationFocusState("release-follow-up", [
      buildSubmission("released-1", "released"),
    ]);

    expect(state).toMatchObject({
      resolvedFocus: "release-follow-up",
      redirected: false,
      statusFilter: "released",
      selectedSubmissionIds: ["released-1"],
      visibleSubmissionIds: ["released-1"],
      title: "Opened from release follow-up notice",
    });
  });

  it("falls forward from AI results into moderation when moderation has become the active workflow stage", () => {
    const state = getAssignmentNotificationFocusState("ai-results", [
      buildSubmission("moderation-1", "moderation_pending"),
      buildSubmission("moderation-2", "escalated"),
      buildSubmission("graded-1", "ai_graded"),
    ]);

    expect(state).toMatchObject({
      resolvedFocus: "moderation-review",
      redirected: true,
      statusFilter: "all",
      selectedSubmissionIds: ["moderation-1", "moderation-2"],
      visibleSubmissionIds: ["moderation-1", "moderation-2"],
      title: "Opened from an earlier notice after moderation started",
    });
  });

  it("keeps a release notice on approved submissions when release is ready but not yet completed", () => {
    const state = getAssignmentNotificationFocusState("release-follow-up", [
      buildSubmission("approved-1", "approved"),
      buildSubmission("review-1", "under_review"),
    ]);

    expect(state).toMatchObject({
      resolvedFocus: "release-follow-up",
      redirected: false,
      statusFilter: "approved",
      selectedSubmissionIds: ["approved-1"],
      visibleSubmissionIds: ["approved-1"],
      title: "Opened from release-ready notice",
    });
  });
});
