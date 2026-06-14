import type { ActivityItem, AdminSubmissionRow } from "../types";

const GRADED_SUBMISSION_STATUSES = new Set([
  "ai_graded",
  "under_review",
  "approved",
  "released",
  "moderation_pending",
  "moderation_in_progress",
  "moderated",
  "escalated",
]);

export const toActivityTone = (value: string): ActivityItem["tone"] =>
  value === "warning" || value === "success" ? value : "neutral";

export const buildAssignmentSubmissionSummaryMap = (
  submissions: Array<Pick<AdminSubmissionRow, "assignmentId" | "status">>,
) => {
  const summaryByAssignmentId = new Map<string, { submissionCount: number; gradedCount: number; releasedCount: number }>();

  submissions.forEach((submission) => {
    const current = summaryByAssignmentId.get(submission.assignmentId) ?? {
      submissionCount: 0,
      gradedCount: 0,
      releasedCount: 0,
    };

    current.submissionCount += 1;
    if (GRADED_SUBMISSION_STATUSES.has(submission.status)) {
      current.gradedCount += 1;
    }
    if (submission.status === "released") {
      current.releasedCount += 1;
    }

    summaryByAssignmentId.set(submission.assignmentId, current);
  });

  return summaryByAssignmentId;
};

export const buildActivityFeed = ({
  assignments,
  submissions,
  moderationRows,
  auditRows,
  humanizeToken,
}: {
  assignments: Array<{ id: string; createdAt: string; lecturerName: string; moduleCode: string | null; title: string }>;
  submissions: Array<{ id: string; assignmentTitle: string; createdAt?: string; submittedAt: string; status: string; studentLabel: string }>;
  moderationRows: Array<{ id: string; assignmentTitle: string; updatedAt: string; status: string; integrityRiskScore: number | null; disagreement: boolean; triggerSummary: string | null }>;
  auditRows: Array<{ id: string; createdAt: string; actorName: string; action: string; target: string; source: "admin" | "workflow" }>;
  humanizeToken: (value: string) => string;
}): ActivityItem[] => {
  const assignmentItems = assignments.slice(0, 4).map((item) => ({
    id: `assignment-${item.id}`,
    createdAt: item.createdAt,
    title: `${item.lecturerName} created ${item.title}`,
    detail: item.moduleCode ? `Assignment tracked under ${item.moduleCode}.` : "New assignment record created.",
    tone: "neutral" as const,
  }));

  const submissionItems = submissions.slice(0, 4).map((item) => ({
    id: `submission-${item.id}`,
    createdAt: item.submittedAt,
    title: `${item.studentLabel} submitted work`,
    detail: `${item.assignmentTitle} is now in ${humanizeToken(item.status)} state.`,
    tone:
      item.status === "moderation_pending" || item.status === "moderation_in_progress" || item.status === "escalated"
        ? ("warning" as const)
        : ("neutral" as const),
  }));

  const moderationItems = moderationRows.slice(0, 4).map((item) => ({
    id: `moderation-${item.id}`,
    createdAt: item.updatedAt,
    title: `${item.assignmentTitle} moderation is ${humanizeToken(item.status)}`,
    detail:
      item.integrityRiskScore != null
        ? `Integrity risk ${item.integrityRiskScore}%${item.disagreement ? " and marker disagreement detected." : "."}`
        : item.triggerSummary || "Moderation case updated.",
    tone:
      item.status === "escalated" || (item.integrityRiskScore ?? 0) >= 70
        ? ("warning" as const)
        : ("success" as const),
  }));

  const auditItems = auditRows.slice(0, 4).map((item) => ({
    id: `audit-${item.id}`,
    createdAt: item.createdAt,
    title: `${item.actorName} ${item.action.toLowerCase()}`,
    detail: item.target,
    tone: item.source === "admin" ? ("success" as const) : ("neutral" as const),
  }));

  return [...assignmentItems, ...submissionItems, ...moderationItems, ...auditItems]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 10);
};
