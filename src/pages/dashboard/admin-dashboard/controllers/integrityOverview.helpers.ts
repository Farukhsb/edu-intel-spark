import { getIntegrityReviewSummary } from "@/lib/integrityReviews";

export type IntegrityReviewSourceRow = {
  id: string;
  submission_id: string;
  decision: string;
  lecturer_note: string | null;
  created_at: string;
  updated_at: string;
};

export const getIntegrityOverviewAssignmentEntry = (
  assignmentSummaryMap: Map<string, { assignmentId: string; assignmentTitle: string; totalReviews: number; flaggedReviews: number; highRiskCases: number }>,
  assignmentId: string,
  assignmentTitle: string,
) => {
  const existing = assignmentSummaryMap.get(assignmentId) ?? {
    assignmentId,
    assignmentTitle,
    totalReviews: 0,
    flaggedReviews: 0,
    highRiskCases: 0,
  };

  return existing;
};

export const incrementIntegrityOverviewAssignmentEntry = (
  assignmentSummaryMap: Map<string, { assignmentId: string; assignmentTitle: string; totalReviews: number; flaggedReviews: number; highRiskCases: number }>,
  assignmentId: string,
  assignmentTitle: string,
  flagged: boolean,
  highRisk: boolean,
) => {
  const existing = getIntegrityOverviewAssignmentEntry(assignmentSummaryMap, assignmentId, assignmentTitle);
  existing.totalReviews += 1;
  if (flagged) {
    existing.flaggedReviews += 1;
  }
  if (highRisk) {
    existing.highRiskCases += 1;
  }
  assignmentSummaryMap.set(assignmentId, existing);
};

export const buildIntegrityOverviewEvent = (
  review: IntegrityReviewSourceRow,
  submission: { assignmentId?: string | null; assignmentTitle?: string | null; studentLabel?: string | null } | undefined,
  assignmentTitleById: Map<string, string>,
) => {
  const summary = getIntegrityReviewSummary(review);
  const assignmentId = submission?.assignmentId || "unknown-assignment";
  const assignmentTitle = submission?.assignmentTitle || assignmentTitleById.get(assignmentId) || "Unknown assignment";

  return {
    assignmentId,
    assignmentTitle,
    event: {
      id: review.id,
      reviewedAt: review.updated_at,
      assignmentTitle,
      studentLabel: submission?.studentLabel || "Student record unavailable",
      decision: review.decision,
      summary,
    },
  };
};
