import { useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchAdminDashboardDataset } from "@/lib/data/admin";
import { safeFormatDate } from "@/lib/date";
import { getIntegrityReviewSummary } from "@/lib/integrityReviews";
import { log } from "@/lib/logger";
import {
  buildOperationalMonitoringSnapshot,
} from "@/lib/operationalMonitoring";
import { parseAdminDashboardSearchState } from "@/lib/schemas/navigation";
import { toast } from "sonner";

import {
  type ActivityItem,
  type AdminAssignmentRow,
  type AdminAuditRow,
  type AdminDataAccessLogRow,
  type AdminDashboardState,
  type AdminGovernanceStatus,
  type AdminIntegrityAssignmentSummaryRow,
  type AdminIntegrityEventRow,
  type AdminIntegrityOverview,
  type AdminMetrics,
  type AdminModerationRow,
  type AdminModerationAuditRow,
  type AdminPolicyExceptionRow,
  type AdminSubmissionRow,
  type AdminUserRow,
  type AdminView,
  type AssignmentSubmissionSummary,
  type PendingRoleChange,
  type SelectedUserPreview,
} from "./types";
import { humanizeToken } from "./utils";

const toActivityTone = (value: string): ActivityItem["tone"] =>
  value === "warning" || value === "success" ? value : "neutral";

const EMPTY_METRICS: AdminMetrics = {
  totalUsers: 0,
  activeLecturers: 0,
  activeStudents: 0,
  totalAssignments: 0,
  totalSubmissions: 0,
  pendingModerationCases: 0,
  aiGradingFailures: null,
  highIntegrityRiskCases: 0,
};

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

const getFunctionErrorMessage = async (error: unknown, fallback: string) => {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json();
      if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
        return payload.error;
      }
    } catch {
      return error.message || fallback;
    }

    return error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
};

const buildAssignmentSubmissionSummaryMap = (
  submissions: Array<Pick<AdminSubmissionRow, "assignmentId" | "status">>,
) => {
  const summaryByAssignmentId = new Map<string, AssignmentSubmissionSummary>();

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

const buildActivityFeed = ({
  assignments,
  submissions,
  moderationRows,
  auditRows,
}: {
  assignments: AdminAssignmentRow[];
  submissions: AdminSubmissionRow[];
  moderationRows: AdminModerationRow[];
  auditRows: AdminAuditRow[];
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

const OVERDUE_MODERATION_DAYS = 7;

const toGovernanceStatus = (available: boolean, rowCount: number): AdminGovernanceStatus =>
  !available ? "unavailable" : rowCount > 0 ? "available" : "empty";

const buildDataAccessLogRows = ({
  adminAuditRows,
  workflowAuditRows,
  academicAccessEvents,
  lecturerNameById,
}: {
  adminAuditRows: Array<{
    id: string;
    created_at: string;
    action_type: string;
    actor_role: string | null;
    target_user_name: string | null;
    target_user_email: string | null;
    details: unknown;
  }>;
  workflowAuditRows: Array<{
    id: string;
    created_at: string;
    event_type: string;
    submission_id: string | null;
    moderation_case_id: string | null;
    reason: string | null;
  }>;
  academicAccessEvents: Array<{
    id: string;
    created_at: string;
    actor_id: string;
    actor_role: string;
    event_type: string;
    resource_type: string;
    resource_id: string | null;
    assignment_id: string | null;
    submission_id: string | null;
    moderation_case_id: string | null;
    metadata: unknown;
  }>;
  lecturerNameById: Map<string, string>;
}): AdminDataAccessLogRow[] => {
  const adminRows = adminAuditRows.map((row) => {
    const details =
      row.details && typeof row.details === "object" ? (row.details as Record<string, unknown>) : {};
    const actorName =
      typeof details.actor_name === "string" && details.actor_name.trim().length > 0
        ? details.actor_name
        : row.actor_role === "admin"
          ? "Admin"
          : "System";
    const previousRole =
      typeof details.previous_role === "string" && details.previous_role.trim().length > 0
        ? details.previous_role
        : null;
    const updatedRole =
      typeof details.updated_role === "string" && details.updated_role.trim().length > 0
        ? details.updated_role
        : null;

    return {
      id: `admin-access-${row.id}`,
      timestamp: row.created_at,
      actor: actorName,
      actorRole: row.actor_role || "admin",
      action: humanizeToken(row.action_type),
      resourceType: row.target_user_name || row.target_user_email ? "User account" : "Admin event",
      resourceLabel: row.target_user_name || row.target_user_email || "Admin governance record",
      outcome: "Recorded",
      details:
        previousRole || updatedRole
          ? `${previousRole || "unknown"} -> ${updatedRole || "unknown"}${row.target_user_email ? ` | ${row.target_user_email}` : ""}`
          : "Using available admin audit events. Access-specific outcome fields are not yet recorded.",
      source: "admin" as const,
    };
  });

  const workflowRows = workflowAuditRows.map((row) => ({
    id: `workflow-access-${row.id}`,
    timestamp: row.created_at,
    actor: "Workflow",
    actorRole: "system",
    action: humanizeToken(String(row.event_type)),
    resourceType: row.moderation_case_id ? "Moderation case" : "Submission",
    resourceLabel: row.moderation_case_id || row.submission_id || "Workflow record",
    outcome: "Recorded",
    details: row.reason || "Using available workflow audit events.",
    source: "workflow" as const,
  }));

  const academicRows = academicAccessEvents.map((row) => {
    const metadata =
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
    const metadataSummary = Object.entries(metadata)
      .map(([key, value]) => `${humanizeToken(key)}: ${String(value)}`)
      .slice(0, 3)
      .join(" | ");

    return {
      id: `academic-access-${row.id}`,
      timestamp: row.created_at,
      actor: lecturerNameById.get(row.actor_id) || "Authenticated user",
      actorRole: row.actor_role,
      action: humanizeToken(row.event_type),
      resourceType: humanizeToken(row.resource_type),
      resourceLabel:
        row.moderation_case_id ||
        row.submission_id ||
        row.assignment_id ||
        row.resource_id ||
        "Academic evidence record",
      outcome: "Recorded",
      details: metadataSummary || "Academic evidence access recorded.",
      source: "academic-access" as const,
    };
  });

  return [...academicRows, ...adminRows, ...workflowRows].sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
};

const buildIntegrityOverview = ({
  integrityReviews,
  submissionById,
  assignmentTitleById,
}: {
  integrityReviews: Array<{
    id: string;
    submission_id: string;
    decision: string;
    lecturer_note: string | null;
    created_at: string;
    updated_at: string;
  }>;
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

  const flaggedReviews = recentEvents.filter((event) => (event.riskScore ?? 0) >= 55 || event.decision === "Investigate" || event.decision === "Misconduct Concern").length;
  const highRiskCases = recentEvents.filter((event) => (event.riskScore ?? 0) >= 80 || event.decision === "Misconduct Concern").length;

  return {
    totalReviews: recentEvents.length,
    flaggedReviews,
    highRiskCases,
    averageSimilarityScore: similarityScores.length > 0 ? Math.round(similarityScores.reduce((sum, value) => sum + value, 0) / similarityScores.length) : null,
    assignmentsWithMostConcerns: [...assignmentSummaryMap.values()]
      .sort((left, right) => right.flaggedReviews - left.flaggedReviews || right.highRiskCases - left.highRiskCases)
      .slice(0, 5),
    recentEvents: recentEvents
      .sort((left, right) => new Date(right.reviewedAt).getTime() - new Date(left.reviewedAt).getTime())
      .slice(0, 8),
    status: toGovernanceStatus(true, recentEvents.length),
  };
};

const buildModerationAuditRows = ({
  moderationCases,
  assignmentTitleById,
  lecturerNameById,
  submissionById,
  gradeAuditRows,
}: {
  moderationCases: Array<{
    id: string;
    assignment_id: string;
    submission_id: string | null;
    moderator_id: string | null;
    status: string;
    final_agreed_score: number | null;
    final_agreed_feedback: string | null;
    created_at: string;
    updated_at: string;
  }>;
  assignmentTitleById: Map<string, string>;
  lecturerNameById: Map<string, string>;
  submissionById: Map<string, AdminSubmissionRow>;
  gradeAuditRows: Array<{
    moderation_case_id: string | null;
    event_type: string;
    reason: string | null;
  }>;
}): AdminModerationAuditRow[] =>
  moderationCases.map((row) => {
    const submission = row.submission_id ? submissionById.get(row.submission_id) : null;
    const caseAuditRows = gradeAuditRows.filter((auditRow) => auditRow.moderation_case_id === row.id);
    const latestAudit = caseAuditRows[0];
    return {
      id: row.id,
      assignmentTitle: assignmentTitleById.get(row.assignment_id) || "Unknown assignment",
      studentLabel: submission?.studentLabel || "Student record unavailable",
      assignedModerator: row.moderator_id ? lecturerNameById.get(row.moderator_id) || "Unknown moderator" : "Not yet assigned",
      status: humanizeToken(row.status),
      decision:
        row.final_agreed_score != null
          ? `Final score ${row.final_agreed_score}`
          : latestAudit
            ? humanizeToken(String(latestAudit.event_type))
            : "Not yet recorded",
      historySummary: caseAuditRows.length > 0 ? `${caseAuditRows.length} audit event${caseAuditRows.length === 1 ? "" : "s"}` : "No audit history visible",
      noteSummary: row.final_agreed_feedback || latestAudit?.reason || "Not yet recorded",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

const buildPolicyExceptionRows = ({
  moderationCases,
  integrityReviews,
  submissionById,
  assignmentTitleById,
}: {
  moderationCases: Array<{
    id: string;
    assignment_id: string;
    submission_id: string | null;
    status: string;
    moderator_id: string | null;
    final_agreed_feedback: string | null;
    updated_at: string;
  }>;
  integrityReviews: Array<{
    id: string;
    submission_id: string;
    decision: string;
    lecturer_note: string | null;
    updated_at: string;
  }>;
  submissionById: Map<string, AdminSubmissionRow>;
  assignmentTitleById: Map<string, string>;
}): AdminPolicyExceptionRow[] => {
  const now = Date.now();
  const moderationCaseBySubmissionId = new Map(
    moderationCases
      .filter((row) => row.submission_id)
      .map((row) => [row.submission_id as string, row]),
  );
  const rows: AdminPolicyExceptionRow[] = [];

  moderationCases.forEach((row) => {
    const submission = row.submission_id ? submissionById.get(row.submission_id) : null;
    const assignmentTitle = assignmentTitleById.get(row.assignment_id) || "Unknown assignment";
    const studentLabel = submission?.studentLabel || "Student record unavailable";
    const ageInDays = Math.floor((now - new Date(row.updated_at).getTime()) / (1000 * 60 * 60 * 24));

    if (
      (row.status === "moderation_pending" || row.status === "moderation_in_progress" || row.status === "escalated") &&
      ageInDays >= OVERDUE_MODERATION_DAYS
    ) {
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

    if (submission?.status === "released" && row.status !== "approved") {
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

    if ((row.status === "moderation_pending" || row.status === "moderation_in_progress") && !row.moderator_id) {
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
    if (summary.riskScore < 80 && review.decision !== "misconduct-concern") {
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

export const useAdminDashboardController = () => {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const adminSearchState = parseAdminDashboardSearchState(searchParams);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<AdminMetrics>(EMPTY_METRICS);
  const [healthItems, setHealthItems] = useState<AdminDashboardState["healthItems"]>([]);
  const [failureCards, setFailureCards] = useState<AdminDashboardState["failureCards"]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [assignments, setAssignments] = useState<AdminAssignmentRow[]>([]);
  const [submissions, setSubmissions] = useState<AdminSubmissionRow[]>([]);
  const [moderationRows, setModerationRows] = useState<AdminModerationRow[]>([]);
  const [auditRows, setAuditRows] = useState<AdminAuditRow[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [dataAccessLogRows, setDataAccessLogRows] = useState<AdminDataAccessLogRow[]>([]);
  const [dataAccessLogStatus, setDataAccessLogStatus] = useState<AdminGovernanceStatus>("empty");
  const [integrityOverview, setIntegrityOverview] = useState<AdminIntegrityOverview>({
    totalReviews: 0,
    flaggedReviews: 0,
    highRiskCases: 0,
    averageSimilarityScore: null,
    assignmentsWithMostConcerns: [],
    recentEvents: [],
    status: "empty",
  });
  const [moderationAuditRows, setModerationAuditRows] = useState<AdminModerationAuditRow[]>([]);
  const [moderationAuditStatus, setModerationAuditStatus] = useState<AdminGovernanceStatus>("empty");
  const [policyExceptionRows, setPolicyExceptionRows] = useState<AdminPolicyExceptionRow[]>([]);
  const [policyExceptionStatus, setPolicyExceptionStatus] = useState<AdminGovernanceStatus>("empty");
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange>(null);
  const [changingUserId, setChangingUserId] = useState<string | null>(null);
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);
  const [selectedUserPreview, setSelectedUserPreview] = useState<SelectedUserPreview>(null);

  const activeView = useMemo<AdminView>(() => adminSearchState.view, [adminSearchState.view]);

  const activeUserFilter = useMemo(
    () => (adminSearchState.userFilter === "lecturer" || adminSearchState.userFilter === "student" ? adminSearchState.userFilter : null),
    [adminSearchState.userFilter],
  );

  const loadAdminDashboard = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const {
        metricsRes,
        assignmentOversightRes,
        moderationOverviewRes,
        recentActivityRes,
        profiles,
        assignments,
        submissions,
        moderationCases,
        adminAuditRes,
        gradeAuditRes,
        academicAccessEventsRes,
        integrityReviewsRes,
        latestGradeRes,
        notificationsRes,
      } = await fetchAdminDashboardDataset();

      const profileRows = profiles.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        role: String(row.role),
        createdAt: row.created_at ?? null,
      }));

      const lecturerNameById = new Map(
        profileRows.map((row) => [row.id, row.fullName || row.email || "Unknown lecturer"]),
      );

      const rawSubmissions = submissions.map((row) => ({
        id: row.id,
        assignmentId: row.assignment_id,
        studentLabel: row.student_name || row.student_email || "Student record unavailable",
        status: String(row.status),
        submittedAt: row.submitted_at,
        fileName: row.file_name,
      }));

      const submissionSummaryByAssignmentId = buildAssignmentSubmissionSummaryMap(rawSubmissions);
      const rpcAssignmentRows =
        assignmentOversightRes.error || !(assignmentOversightRes.data || []).length
          ? null
          : (assignmentOversightRes.data || []).map((row) => ({
            id: row.id,
            title: row.title,
            moduleCode: row.module_code ?? null,
            lecturerName: row.lecturer_name,
            status: String(row.status),
            dueDate: row.due_date ?? null,
            createdAt: row.created_at,
            submissionCount: Number(row.submission_count ?? 0),
            gradedCount: Number(row.graded_count ?? 0),
            releasedCount: Number(row.released_count ?? 0),
          }));

      if (assignmentOversightRes.error) {
        log.warn("Admin assignment oversight RPC is unavailable; falling back to client-side assignment summaries", {
          view: activeView,
        });
      }

      const clientAssignmentRows = assignments.map((row) => {
        const submissionSummary = submissionSummaryByAssignmentId.get(row.id) ?? {
          submissionCount: 0,
          gradedCount: 0,
          releasedCount: 0,
        };

        return {
          id: row.id,
          title: row.title,
          moduleCode: row.module_code ?? null,
          lecturerName: lecturerNameById.get(row.lecturer_id) || "Unknown lecturer",
          status: String(row.status),
          dueDate: row.due_date ?? null,
          createdAt: row.created_at,
          submissionCount: submissionSummary.submissionCount,
          gradedCount: submissionSummary.gradedCount,
          releasedCount: submissionSummary.releasedCount,
        };
      });
      const assignmentRows = rpcAssignmentRows ?? clientAssignmentRows;

      const assignmentTitleById = new Map(assignmentRows.map((row) => [row.id, row.title]));

      const submissionRows: AdminSubmissionRow[] = rawSubmissions.map((row) => ({
        id: row.id,
        assignmentId: row.assignmentId,
        assignmentTitle: assignmentTitleById.get(row.assignmentId) || "Unknown assignment",
        studentLabel: row.studentLabel,
        status: row.status,
        submittedAt: row.submittedAt,
        fileName: row.fileName,
      }));
      const submissionById = new Map(submissionRows.map((row) => [row.id, row]));

      const rpcModerationRows =
        moderationOverviewRes.error || !(moderationOverviewRes.data || []).length
          ? null
          : (moderationOverviewRes.data || []).map((row) => ({
            id: row.id,
            assignmentTitle: row.assignment_title,
            firstMarkerName: row.first_marker_name,
            moderatorName: row.moderator_name,
            status: String(row.status),
            integrityRiskScore: row.integrity_risk_score ?? null,
            confidenceScore: row.confidence_score ?? null,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            triggerSummary: row.trigger_summary ?? null,
            disagreement: row.disagreement,
          }));

      if (moderationOverviewRes.error) {
        log.warn("Admin moderation overview RPC is unavailable; falling back to client-side moderation joins", {
          view: activeView,
        });
      }

      const clientModerationRows = moderationCases.map((row) => ({
        id: row.id,
        assignmentTitle: assignmentTitleById.get(row.assignment_id) || "Unknown assignment",
        firstMarkerName: row.first_marker_id ? lecturerNameById.get(row.first_marker_id) || "Unknown marker" : "Unassigned",
        moderatorName: row.moderator_id ? lecturerNameById.get(row.moderator_id) || "Unknown moderator" : "Unassigned",
        status: String(row.status),
        integrityRiskScore: row.integrity_risk_score ?? null,
        confidenceScore: row.confidence_score ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        triggerSummary: row.trigger_summary ?? null,
        disagreement:
          row.first_marker_score != null &&
          row.moderator_score != null &&
          Math.abs(Number(row.first_marker_score) - Number(row.moderator_score)) >= 5,
      }));
      const moderationCaseRows = rpcModerationRows ?? clientModerationRows;

      let adminAuditRows: AdminAuditRow[] = [];
      let adminDataAccessEvents: Array<{
        id: string;
        created_at: string;
        action_type: string;
        actor_role: string | null;
        target_user_name: string | null;
        target_user_email: string | null;
        details: unknown;
      }> = [];
      let adminAuditAvailable = false;
      try {
        if (adminAuditRes.error) {
          throw adminAuditRes.error;
        }
        adminAuditAvailable = true;
        adminDataAccessEvents = adminAuditRes.data || [];

        adminAuditRows = adminDataAccessEvents.map((row) => {
          const details = (row.details ?? {}) as {
            actor_name?: string;
            previous_role?: string;
            updated_role?: string;
          };

          return {
            id: `admin-${row.id}`,
            createdAt: row.created_at,
            actorName: details.actor_name || "Admin",
            action: humanizeToken(String(row.action_type)),
            target: row.target_user_name || "Unknown user",
            detail:
              details.previous_role || details.updated_role
                ? `${details.previous_role || "unknown"} -> ${details.updated_role || "unknown"}${row.target_user_email ? ` | ${row.target_user_email}` : ""}`
                : row.target_user_email || "Admin audit event recorded",
            source: "admin" as const,
          };
        });
      } catch {
        log.warn("Admin audit log is unavailable", {
          view: "audit",
        });
      }

      let workflowAuditRows: AdminAuditRow[] = [];
      let workflowDataAccessEvents: Array<{
        id: string;
        created_at: string;
        event_type: string;
        submission_id: string | null;
        moderation_case_id: string | null;
        reason: string | null;
      }> = [];
      let latestGradeRun: string | null = null;
      let aiGradingFailures: number | null = null;
      let emailNotificationsVisible = false;
      let emailNotificationsCount = 0;
      let gradeAuditAvailable = false;
      let academicAccessEventsAvailable = false;
      let academicAccessEvents: Array<{
        id: string;
        created_at: string;
        actor_id: string;
        actor_role: string;
        event_type: string;
        resource_type: string;
        resource_id: string | null;
        assignment_id: string | null;
        submission_id: string | null;
        moderation_case_id: string | null;
        metadata: unknown;
      }> = [];

      try {
        if (gradeAuditRes.error) {
          throw gradeAuditRes.error;
        }
        gradeAuditAvailable = true;
        workflowDataAccessEvents = gradeAuditRes.data || [];

        workflowAuditRows = workflowDataAccessEvents.map((row) => ({
          id: `workflow-${row.id}`,
          createdAt: row.created_at,
          actorName: "Workflow",
          action: humanizeToken(String(row.event_type)),
          target: `Submission ${row.submission_id}`,
          detail: row.reason || "Workflow event recorded",
          source: "workflow" as const,
        }));

        const todayKey = new Date().toISOString().slice(0, 10);
        aiGradingFailures = workflowDataAccessEvents.filter((row) => {
          const eventType = String(row.event_type).toLowerCase();
          return row.created_at.startsWith(todayKey) && (eventType.includes("fail") || eventType.includes("error"));
        }).length;
      } catch {
        log.warn("Grade workflow audit is unavailable to admin", {
          view: "system",
        });
      }

      try {
        if (latestGradeRes.error) {
          throw latestGradeRes.error;
        }

        latestGradeRun = latestGradeRes.data?.[0]?.created_at ?? null;
      } catch {
        log.warn("Grades are unavailable to admin dashboard", {
          view: "system",
        });
      }

      try {
        if (notificationsRes.error) {
          throw notificationsRes.error;
        }

        emailNotificationsVisible = true;
        emailNotificationsCount = (notificationsRes.data || []).length;
      } catch {
        log.warn("Communication notifications are unavailable to admin dashboard", {
          view: "system",
        });
      }

      try {
        if (academicAccessEventsRes.error) {
          throw academicAccessEventsRes.error;
        }

        academicAccessEventsAvailable = true;
        academicAccessEvents = academicAccessEventsRes.data || [];
      } catch {
        log.warn("Academic access events are unavailable to admin dashboard", {
          view: "data-access-log",
        });
      }

      let integrityReviewsAvailable = false;
      let integrityReviewRows: Array<{
        id: string;
        submission_id: string;
        decision: string;
        lecturer_note: string | null;
        created_at: string;
        updated_at: string;
      }> = [];

      try {
        if (integrityReviewsRes.error) {
          throw integrityReviewsRes.error;
        }

        integrityReviewsAvailable = true;
        integrityReviewRows = (integrityReviewsRes.data || []).map((row) => ({
          id: row.id,
          submission_id: row.submission_id,
          decision: row.decision,
          lecturer_note: row.lecturer_note,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));
      } catch {
        log.warn("Academic integrity reviews are unavailable to admin dashboard", {
          view: "integrity-overview",
        });
      }

      const mergedAuditRows = [...adminAuditRows, ...workflowAuditRows]
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        .slice(0, 25);
      const dataAccessRows = buildDataAccessLogRows({
        adminAuditRows: adminDataAccessEvents,
        workflowAuditRows: workflowDataAccessEvents,
        academicAccessEvents,
        lecturerNameById,
      });
      const moderationAuditRows = buildModerationAuditRows({
        moderationCases,
        assignmentTitleById,
        lecturerNameById,
        submissionById,
        gradeAuditRows: workflowDataAccessEvents,
      });
      const nextIntegrityOverview = integrityReviewsAvailable
        ? buildIntegrityOverview({
            integrityReviews: integrityReviewRows,
            submissionById,
            assignmentTitleById,
          })
        : {
            totalReviews: 0,
            flaggedReviews: 0,
            highRiskCases: 0,
            averageSimilarityScore: null,
            assignmentsWithMostConcerns: [],
            recentEvents: [],
            status: "unavailable" as const,
          };
      const policyExceptionRows = buildPolicyExceptionRows({
        moderationCases,
        integrityReviews: integrityReviewRows,
        submissionById,
        assignmentTitleById,
      });
      const rpcActivityFeed = recentActivityRes.error
        ? null
        : (recentActivityRes.data || []).map((row) => ({
            id: row.id,
            createdAt: row.created_at,
            title: row.title,
            detail: row.detail,
            tone: toActivityTone(row.tone),
          }));

      if (recentActivityRes.error) {
        log.warn("Admin recent activity RPC is unavailable; falling back to client-side activity synthesis", {
          view: activeView,
        });
      }

      const pendingModerationCases = moderationCaseRows.filter((row) =>
        row.status === "moderation_pending" || row.status === "moderation_in_progress" || row.status === "escalated",
      ).length;

      const highIntegrityRiskCases = moderationCaseRows.filter((row) => (row.integrityRiskScore ?? 0) >= 70 || row.status === "escalated").length;
      const rpcMetrics = metricsRes.error ? null : metricsRes.data?.[0] ?? null;

      if (metricsRes.error) {
        log.warn("Admin metrics RPC is unavailable; falling back to client-side snapshot counts", {
          view: activeView,
        });
      }

      const monitoringSnapshot = buildOperationalMonitoringSnapshot({
        latestGradeRun,
        aiGradingFailures,
        moderationRows: moderationCaseRows,
        submissions: submissionRows,
        emailNotificationsVisible,
        emailNotificationsCount,
      });

      setUsers(profileRows);
      setAssignments(assignmentRows);
      setSubmissions(submissionRows);
      setModerationRows(moderationCaseRows);
      setAuditRows(mergedAuditRows);
      setDataAccessLogRows(dataAccessRows);
      setDataAccessLogStatus(
        toGovernanceStatus(adminAuditAvailable || gradeAuditAvailable || academicAccessEventsAvailable, dataAccessRows.length),
      );
      setIntegrityOverview(nextIntegrityOverview);
      setModerationAuditRows(moderationAuditRows);
      setModerationAuditStatus(toGovernanceStatus(true, moderationAuditRows.length));
      setPolicyExceptionRows(policyExceptionRows);
      setPolicyExceptionStatus(
        integrityReviewsAvailable
          ? toGovernanceStatus(true, policyExceptionRows.length)
          : policyExceptionRows.length > 0
            ? "available"
            : "unavailable",
      );
      setMetrics({
        totalUsers: rpcMetrics?.total_users ?? profileRows.length,
        activeLecturers: rpcMetrics?.active_lecturers ?? profileRows.filter((row) => row.role === "lecturer").length,
        activeStudents: rpcMetrics?.active_students ?? profileRows.filter((row) => row.role === "student").length,
        totalAssignments: rpcMetrics?.total_assignments ?? assignmentRows.length,
        totalSubmissions: rpcMetrics?.total_submissions ?? submissionRows.length,
        pendingModerationCases: rpcMetrics?.pending_moderation_cases ?? pendingModerationCases,
        aiGradingFailures,
        highIntegrityRiskCases: rpcMetrics?.high_integrity_risk_cases ?? highIntegrityRiskCases,
      });
      setHealthItems(monitoringSnapshot.healthItems.map((item) => ({
        ...item,
        statusLabel:
          item.label === "Last successful grading run" && latestGradeRun
            ? safeFormatDate(latestGradeRun, "MMM d, HH:mm", "Recorded")
            : item.statusLabel,
        detail:
          item.label === "AI grading service" && latestGradeRun
            ? item.tone === "warning"
              ? `${item.detail} The latest visible grade row was recorded ${safeFormatDate(latestGradeRun, "MMM d, yyyy HH:mm", "recently")}.`
              : `Latest grading evidence visible to admin was recorded ${safeFormatDate(latestGradeRun, "MMM d, yyyy HH:mm", "recently")}. This is an observed grading timestamp, not a live service heartbeat.`
            : item.detail,
      })));
      setFailureCards(monitoringSnapshot.failureCards);
      setActivityFeed(
        rpcActivityFeed ??
          buildActivityFeed({
            assignments: assignmentRows,
            submissions: submissionRows,
            moderationRows: moderationCaseRows,
            auditRows: mergedAuditRows,
          }),
      );
    } catch (error) {
      log.error("Failed to load admin dashboard", error, {
        view: activeView,
      });
      toast.error("Admin dashboard data could not be loaded right now.");
    }

    if (!silent) {
      setLoading(false);
    } else {
      setRefreshing(false);
    }
  };

  const visibleUsers = useMemo(() => {
    if (!activeUserFilter) {
      return users;
    }

    return users.filter((user) => user.role === activeUserFilter);
  }, [activeUserFilter, users]);

  useEffect(() => {
    if (profile?.role !== "admin") {
      setLoading(false);
      return;
    }

    void loadAdminDashboard();
  }, [profile?.role]);

  const requestRoleChange = (user: AdminUserRow, nextRole: "student" | "lecturer") => {
    setPendingRoleChange({
      userId: user.id,
      fullName: user.fullName,
      currentRole: user.role,
      nextRole,
    });
  };

  const confirmRoleChange = async () => {
    if (!pendingRoleChange) return;

    setChangingUserId(pendingRoleChange.userId);
    try {
      const { error } = await supabase.functions.invoke("admin-set-user-role", {
        body: {
          targetUserId: pendingRoleChange.userId,
          nextRole: pendingRoleChange.nextRole,
        },
      });

      if (error) throw error;

      toast.success(`${pendingRoleChange.fullName || "User"} is now set to ${pendingRoleChange.nextRole}.`);
      setPendingRoleChange(null);
      await loadAdminDashboard({ silent: true });
    } catch (error) {
      log.error("Failed to update user role", error, {
        targetUserId: pendingRoleChange.userId,
        nextRole: pendingRoleChange.nextRole,
      });
      toast.error(await getFunctionErrorMessage(error, "Role change could not be completed."));
    }
    setChangingUserId(null);
  };

  const syncUserRoleMetadata = async (targetUser: AdminUserRow) => {
    setSyncingUserId(targetUser.id);
    try {
      const { error } = await supabase.functions.invoke("admin-set-user-role", {
        body: {
          targetUserId: targetUser.id,
          syncOnly: true,
        },
      });

      if (error) throw error;

      toast.success(`Auth metadata synced for ${targetUser.fullName || "user"}.`);
      await loadAdminDashboard({ silent: true });
    } catch (error) {
      log.error("Failed to sync auth metadata for user", error, {
        targetUserId: targetUser.id,
      });
      toast.error(await getFunctionErrorMessage(error, "Auth metadata could not be synced."));
    }
    setSyncingUserId(null);
  };

  return {
    profile,
    state: {
      loading,
      refreshing,
      metrics,
      healthItems,
      failureCards,
      users,
      assignments,
      submissions,
      moderationRows,
      auditRows,
      activityFeed,
      dataAccessLogRows,
      dataAccessLogStatus,
      integrityOverview,
      moderationAuditRows,
      moderationAuditStatus,
      policyExceptionRows,
      policyExceptionStatus,
      activeView,
      activeUserFilter,
      visibleUsers,
      pendingRoleChange,
      changingUserId,
      syncingUserId,
      selectedUserPreview,
    } satisfies AdminDashboardState,
    actions: {
      loadAdminDashboard,
      requestRoleChange,
      confirmRoleChange,
      syncUserRoleMetadata,
      setPendingRoleChange,
      setSelectedUserPreview,
    },
  };
};
