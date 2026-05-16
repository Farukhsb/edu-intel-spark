export interface LecturerOverviewReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

export const getLecturerOverviewReadiness = ({
  pendingCount,
  atRiskCount,
  assignmentCount,
  leadPendingAssignmentTitle,
}: {
  pendingCount: number;
  atRiskCount: number;
  assignmentCount: number;
  leadPendingAssignmentTitle: string | null;
}): LecturerOverviewReadiness => {
  if (pendingCount > 0) {
    return {
      postureLabel: "Active review position",
      likelyChallenge: leadPendingAssignmentTitle
        ? `${leadPendingAssignmentTitle} is still leading the review queue`
        : `${pendingCount} submission${pendingCount === 1 ? "" : "s"} still need review`,
      bestNextAction: "Clear grading, moderation, and approval blockers before the queue grows further",
    };
  }

  if (atRiskCount > 0) {
    return {
      postureLabel: "Targeted support position",
      likelyChallenge: `${atRiskCount} student${atRiskCount === 1 ? "" : "s"} still sit below target`,
      bestNextAction: "Open performance insights and prioritise support for the highest-risk students",
    };
  }

  if (assignmentCount > 0) {
    return {
      postureLabel: "Live delivery position",
      likelyChallenge: `${assignmentCount} active assignment${assignmentCount === 1 ? "" : "s"} still need routine monitoring`,
      bestNextAction: "Track live submissions and keep release-ready work moving through the workflow",
    };
  }

  return {
    postureLabel: "Setup position",
    likelyChallenge: "No live assignment workflow is generating review signals yet",
    bestNextAction: "Create or publish the next assignment to start the teaching workflow",
  };
};
