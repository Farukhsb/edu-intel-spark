import { getIntegrityReviewSummary } from "@/lib/integrityReviews";

import type {
  AdminModerationAuditRow,
  AdminPolicyExceptionRow,
  AdminSubmissionRow,
} from "../types";
import { humanizeToken } from "../utils";
import {
  hasUnresolvedReleasedGrade,
  isOverdueModerationCase,
  needsAssignedModerator,
  shouldFlagHighIntegrityReview,
  type GradeAuditModerationSourceRow,
  type IntegrityReviewPolicySourceRow,
  type ModerationCaseAuditSourceRow,
} from "./moderationAudit.helpers";

export const buildModerationAuditRows = ({
  moderationCases,
  assignmentTitleById,
  lecturerNameById,
  submissionById,
  gradeAuditRows,
}: {
  moderationCases: ModerationCaseAuditSourceRow[];
  assignmentTitleById: Map<string, string>;
  lecturerNameById: Map<string, string>;
  submissionById: Map<string, AdminSubmissionRow>;
  gradeAuditRows: GradeAuditModerationSourceRow[];
}): AdminModerationAuditRow[] =>
  moderationCases.map((row) => {
    const submission = row.submission_id ? submissionById.get(row.submission_id) : null;
    const caseAuditRows = gradeAuditRows.filter((auditRow) => auditRow.moderation_case_id === row.id);
    const latestAudit = caseAuditRows[0];
    return {
      id: row.id,
      assignmentTitle: assignmentTitleById.get(row.assignment_id) || "Unknown assignment",
      studentLabel: submission?.studentLabel || "Student record unavailable",
      assignedModerator: row.moderator_id
        ? lecturerNameById.get(row.moderator_id) || "Unknown moderator"
        : "Not yet assigned",
      status: humanizeToken(row.status),
      decision:
        row.final_agreed_score != null
          ? `Final score ${row.final_agreed_score}`
          : latestAudit
            ? humanizeToken(String(latestAudit.event_type))
            : "Not yet recorded",
      historySummary:
        caseAuditRows.length > 0
          ? `${caseAuditRows.length} audit event${caseAuditRows.length === 1 ? "" : "s"}`
          : "No audit history visible",
      noteSummary: row.final_agreed_feedback || latestAudit?.reason || "Not yet recorded",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

export const buildPolicyExceptionRows = ({
  moderationCases,
  integrityReviews,
  submissionById,
  assignmentTitleById,
}: {
  moderationCases: Array<Pick<ModerationCaseAuditSourceRow, "id" | "assignment_id" | "submission_id" | "status" | "moderator_id" | "final_agreed_feedback" | "updated_at">>;
  integrityReviews: IntegrityReviewPolicySourceRow[];
  submissionById: Map<string, AdminSubmissionRow>;
  assignmentTitleById: Map<string, string>;
}): AdminPolicyExceptionRow[] => {
  const now = Date.now();
  const moderationCaseBySubmissionId = new Map(
    moderationCases.filter((row) => row.submission_id).map((row) => [row.submission_id as string, row]),
  );
  const rows: AdminPolicyExceptionRow[] = [];

  moderationCases.forEach((row) => {
    const submission = row.submission_id ? submissionById.get(row.submission_id) : null;
    const assignmentTitle = assignmentTitleById.get(row.assignment_id) || "Unknown assignment";
    const studentLabel = submission?.studentLabel || "Student record unavailable";
    const ageInDays = Math.floor((now - new Date(row.updated_at).getTime()) / (1000 * 60 * 60 * 24));

    if (isOverdueModerationCase(row.status, ageInDays)) {
      rows.push({
        id: `overdue-${row.id}`,
        type: "Overdue moderation case",
        severity: row.status === "escalated" ? "high" : "medium",
        assignmentTitle,
        studentLabel,
        status: humanizeToken(row.status),
        detectedAt: row.updated_at,
        details: `Case has been in ${humanizeToken(row.status)} for ${ageInDays} days.`,
      });
    }

    if ((row.status === "moderated" || row.status === "approved") && !row.final_agreed_feedback) {
      rows.push({
        id: `missing-evidence-${row.id}`,
        type: "Missing moderation evidence",
        severity: "medium",
        assignmentTitle,
        studentLabel,
        status: humanizeToken(row.status),
        detectedAt: row.updated_at,
        details: "Moderation outcome exists but no final agreed feedback is recorded.",
      });
    }

    if (hasUnresolvedReleasedGrade(submission?.status, row.status)) {
      rows.push({
        id: `released-unresolved-${row.id}`,
        type: "Released grade with unresolved moderation",
        severity: "high",
        assignmentTitle,
        studentLabel,
        status: humanizeToken(row.status),
        detectedAt: row.updated_at,
        details: "Submission is already released while the linked moderation case is not approved.",
      });
    }

    if (needsAssignedModerator(row.status, row.moderator_id)) {
      rows.push({
        id: `unassigned-${row.id}`,
        type: "Moderation case without assigned moderator",
        severity: "medium",
        assignmentTitle,
        studentLabel,
        status: humanizeToken(row.status),
        detectedAt: row.updated_at,
        details: "Case is awaiting moderation work but no moderator is assigned.",
      });
    }
  });

  integrityReviews.forEach((review) => {
    const summary = getIntegrityReviewSummary(review);
    if (!shouldFlagHighIntegrityReview(summary.riskScore, review.decision)) {
      return;
    }

    if (moderationCaseBySubmissionId.has(review.submission_id)) {
      return;
    }

    const submission = submissionById.get(review.submission_id);
    rows.push({
      id: `integrity-${review.id}`,
      type: "High integrity risk without moderation case",
      severity: "high",
      assignmentTitle: submission?.assignmentTitle || "Unknown assignment",
      studentLabel: submission?.studentLabel || "Student record unavailable",
      status: humanizeToken(review.decision),
      detectedAt: review.updated_at,
      details: "Integrity review is high risk or a misconduct concern, but no linked moderation case is visible.",
    });
  });

  return rows.sort((left, right) => new Date(right.detectedAt).getTime() - new Date(left.detectedAt).getTime());
};
