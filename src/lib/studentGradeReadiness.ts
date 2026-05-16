export interface StudentGradeReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

export const getStudentGradeReadiness = ({
  releasedCount,
  pendingCount,
  latestReleasedAssignmentTitle,
  latestPendingStatus,
}: {
  releasedCount: number;
  pendingCount: number;
  latestReleasedAssignmentTitle: string | null;
  latestPendingStatus: string | null;
}): StudentGradeReadiness => {
  if (releasedCount > 0) {
    return {
      postureLabel: "You have a released result ready",
      likelyChallenge: latestReleasedAssignmentTitle
        ? `${latestReleasedAssignmentTitle} has feedback ready to review`
        : "A released result is ready to review",
      bestNextAction: "Open the released result and review the criterion feedback",
    };
  }

  if (pendingCount > 0) {
    return {
      postureLabel: "Your result is still being prepared",
      likelyChallenge: latestPendingStatus
        ? `${latestPendingStatus.replace(/_/g, " ")} is still blocking release`
        : "Your submission is still in review",
      bestNextAction: "Wait for marking and moderation to complete before checking again",
    };
  }

  return {
    postureLabel: "No released results yet",
    likelyChallenge: "No submitted work has produced a released result yet",
    bestNextAction: "Head to assignments and submit work to start the grading workflow",
  };
};
