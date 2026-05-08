import { canReleaseStatus } from "@/lib/assessmentWorkflow";
import type { AssignmentDetailSubmission, SubmissionStatus } from "@/pages/dashboard/assignment-detail/types";

export interface ModerationReleaseHandoffState {
  kind: "release-ready" | "released" | "empty";
  statusFilter: "all" | SubmissionStatus;
  selectedSubmissionIds: string[];
  title: string;
  description: string;
}

export const getModerationReleaseHandoffState = (
  submissions: AssignmentDetailSubmission[],
): ModerationReleaseHandoffState => {
  const releaseReadySubmissionIds = submissions
    .filter((submission) => canReleaseStatus(submission.status))
    .map((submission) => submission.id);

  if (releaseReadySubmissionIds.length > 0) {
    return {
      kind: "release-ready",
      statusFilter: "approved",
      selectedSubmissionIds: releaseReadySubmissionIds,
      title: "Opened from moderation release handoff",
      description: "The submission list is focused on approved work that is ready to release to students.",
    };
  }

  const releasedSubmissionIds = submissions
    .filter((submission) => submission.status === "released")
    .map((submission) => submission.id);

  if (releasedSubmissionIds.length > 0) {
    return {
      kind: "released",
      statusFilter: "released",
      selectedSubmissionIds: releasedSubmissionIds,
      title: "Opened from moderation handoff after release",
      description: "The earlier moderation handoff has already completed, so the list is focused on submissions that were released to students.",
    };
  }

  return {
    kind: "empty",
    statusFilter: "approved",
    selectedSubmissionIds: [],
    title: "Opened from moderation release handoff",
    description: "No approved or released submissions currently match this older moderation handoff.",
  };
};
