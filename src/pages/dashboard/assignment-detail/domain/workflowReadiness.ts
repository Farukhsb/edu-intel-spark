import type { SubmissionStatus } from "@/pages/dashboard/assignment-detail/types";

export interface AssignmentWorkflowReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

const formatCount = (count: number, label: string) =>
  `${count} ${label}${count === 1 ? "" : "s"}`;

export const getLecturerAssignmentWorkflowReadiness = ({
  statuses,
  hasReleaseReady,
  hasApprovable,
  integrityRuntimeWarning,
}: {
  statuses: SubmissionStatus[];
  hasReleaseReady: boolean;
  hasApprovable: boolean;
  integrityRuntimeWarning: string | null;
}): AssignmentWorkflowReadiness => {
  const count = (status: SubmissionStatus) => statuses.filter((value) => value === status).length;
  const moderationCount =
    count("moderation_pending") + count("moderation_in_progress") + count("escalated");
  const reviewCount = count("submitted") + count("ai_graded") + count("first_review") + count("under_review");
  const releasedCount = count("released");

  return {
    postureLabel:
      moderationCount > 0
        ? "Active review position"
        : hasReleaseReady || hasApprovable
          ? "Release handoff position"
          : reviewCount > 0
            ? "Marking in progress position"
            : releasedCount > 0
              ? "Released outcomes position"
              : "Submission intake position",
    likelyChallenge:
      integrityRuntimeWarning ||
      (moderationCount > 0
        ? `${formatCount(moderationCount, "submission")} still in moderation or escalation`
        : hasReleaseReady
          ? `${formatCount(count("approved"), "approved submission")} ready to release`
          : reviewCount > 0
            ? `${formatCount(reviewCount, "submission")} still needs grading or review`
            : releasedCount > 0
              ? `${formatCount(releasedCount, "submission")} already released`
              : "No workflow pressure point yet"),
    bestNextAction:
      moderationCount > 0
        ? "Open moderation-linked submissions and clear blocked review cases"
        : hasReleaseReady
          ? "Release approved submissions and send release notes"
          : hasApprovable
            ? "Approve reviewed submissions before release"
            : reviewCount > 0
              ? "Run grading or complete first review on the remaining submissions"
              : "Maintain the current assignment workflow",
  };
};

export const getStudentAssignmentWorkflowReadiness = ({
  currentStatus,
}: {
  currentStatus: SubmissionStatus | null;
}): AssignmentWorkflowReadiness => {
  if (!currentStatus) {
    return {
      postureLabel: "Ready to submit position",
      likelyChallenge: "No submission has entered the workflow yet",
      bestNextAction: "Upload your work to start grading and review",
    };
  }

  if (currentStatus === "released") {
    return {
      postureLabel: "Released result position",
      likelyChallenge: "Your released feedback is now available to review",
      bestNextAction: "Open the released result and review the feedback summary",
    };
  }

  if (currentStatus === "approved") {
    return {
      postureLabel: "Awaiting release position",
      likelyChallenge: "Your submission is approved but not yet released to students",
      bestNextAction: "Wait for final grade release and check back for the released result",
    };
  }

  if (
    currentStatus === "moderation_pending" ||
    currentStatus === "moderation_in_progress" ||
    currentStatus === "escalated"
  ) {
    return {
      postureLabel: "Moderation in progress position",
      likelyChallenge: "Your submission is still in moderation before final release",
      bestNextAction: "Wait for the moderation workflow to complete before checking again",
    };
  }

  return {
    postureLabel: "Assessment in progress position",
    likelyChallenge: "Your submission is still moving through grading and review",
    bestNextAction: "Check back later for the final released result",
  };
};
