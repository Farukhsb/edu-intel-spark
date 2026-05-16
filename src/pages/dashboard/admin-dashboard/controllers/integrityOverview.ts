import { getIntegrityReviewSummary } from "@/lib/integrityReviews";

import type {
  AdminIntegrityAssignmentSummaryRow,
  AdminIntegrityEventRow,
  AdminIntegrityOverview,
  AdminSubmissionRow,
} from "../types";
import { toGovernanceStatus } from "./governance";
import { humanizeToken } from "../utils";

type IntegrityReviewSourceRow = {
  id: string;
  submission_id: string;
  decision: string;
  lecturer_note: string | null;
  created_at: string;
  updated_at: string;
};

export const buildIntegrityOverview = ({
  integrityReviews,
  submissionById,
  assignmentTitleById,
}: {
  integrityReviews: IntegrityReviewSourceRow[];
  submissionById: Map<string, AdminSubmissionRow>;
  assignmentTitleById: Map<string, string>;
}): AdminIntegrityOverview => {
  const assignmentSummaryMap = new Map<string, AdminIntegrityAssignmentSummaryRow>();
  const similarityScores: number[] = [];

  const recentEvents: AdminIntegrityEventRow[] = integrityReviews.map((review) => {
    const submission = submissionById.get(review.submission_id);
    const summary = getIntegrityReviewSummary(review);
    const assignmentId = submission?.assignmentId || "unknown-assignment";
    const assignmentTitle = submission?.assignmentTitle || assignmentTitleById.get(assignmentId) || "Unknown assignment";
    const existing = assignmentSummaryMap.get(assignmentId) ?? {
      assignmentId,
      assignmentTitle,
      totalReviews: 0,
      flaggedReviews: 0,
      highRiskCases: 0,
    };
    existing.totalReviews += 1;
    if (summary.flagged) {
      existing.flaggedReviews += 1;
    }
    if (summary.riskScore >= 80 || review.decision === "misconduct-concern") {
      existing.highRiskCases += 1;
    }
    assignmentSummaryMap.set(assignmentId, existing);

    const similarityScore = summary.payload.integritySnapshot?.similarityScore ?? null;
    if (similarityScore != null) {
      similarityScores.push(similarityScore);
    }

    return {
      id: review.id,
      reviewedAt: review.updated_at,
      assignmentTitle,
      studentLabel: submission?.studentLabel || "Student record unavailable",
      decision: humanizeToken(review.decision),
      riskScore: summary.riskScore || null,
      similarityScore,
      flags: summary.payload.integritySnapshot?.flags || [],
      latestNote: summary.payload.latestNote || "Not yet recorded",
    };
  });

  const flaggedReviews = recentEvents.filter(
    (event) =>
      (event.riskScore ?? 0) >= 55 || event.decision === "Investigate" || event.decision === "Misconduct Concern",
  ).length;
  const highRiskCases = recentEvents.filter(
    (event) => (event.riskScore ?? 0) >= 80 || event.decision === "Misconduct Concern",
  ).length;

  return {
    totalReviews: recentEvents.length,
    flaggedReviews,
    highRiskCases,
    averageSimilarityScore:
      similarityScores.length > 0
        ? Math.round(similarityScores.reduce((sum, value) => sum + value, 0) / similarityScores.length)
        : null,
    assignmentsWithMostConcerns: [...assignmentSummaryMap.values()]
      .sort((left, right) => right.flaggedReviews - left.flaggedReviews || right.highRiskCases - left.highRiskCases)
      .slice(0, 5),
    recentEvents: recentEvents
      .sort((left, right) => new Date(right.reviewedAt).getTime() - new Date(left.reviewedAt).getTime())
      .slice(0, 8),
    status: toGovernanceStatus(true, recentEvents.length),
  };
};
