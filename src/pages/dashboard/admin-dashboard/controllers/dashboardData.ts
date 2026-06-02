import { safeFormatDate } from "@/lib/date";
import { getDepartmentName } from "@/lib/department";
import { log } from "@/lib/logger";
import { buildOperationalMonitoringSnapshot } from "@/lib/operationalMonitoring";
import { parseAppRole } from "@/lib/roles";

import type {
  ActivityItem,
  AdminAssignmentRow,
  AdminAuditRow,
  AdminDashboardState,
  AdminGovernanceStatus,
  AdminIntegrityOverview,
  AdminMetrics,
  AdminModerationRow,
  AdminModerationAuditRow,
  AdminPolicyExceptionRow,
  AdminSubmissionRow,
  AdminUserRow,
  AssignmentSubmissionSummary,
} from "../types";
import { humanizeToken } from "../utils";
import { buildDataAccessLogRows } from "./accessLog";
import { toGovernanceStatus } from "./governance";
import { buildIntegrityOverview } from "./integrityOverview";
import { buildModerationAuditRows, buildPolicyExceptionRows } from "./moderationAudit";

const toActivityTone = (value: string): ActivityItem["tone"] =>
  value === "warning" || value === "success" ? value : "neutral";

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

export const EMPTY_METRICS: AdminMetrics = {
  totalUsers: 0,
  activeLecturers: 0,
  activeStudents: 0,
  totalAssignments: 0,
  totalSubmissions: 0,
  pendingModerationCases: 0,
  aiGradingFailures: null,
  highIntegrityRiskCases: 0,
};

export const EMPTY_INTEGRITY_OVERVIEW: AdminIntegrityOverview = {
  totalReviews: 0,
  flaggedReviews: 0,
  highRiskCases: 0,
  averageSimilarityScore: null,
  assignmentsWithMostConcerns: [],
  recentEvents: [],
  status: "empty",
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

export const buildAdminDashboardData = ({
  dataset,
  activeView,
}: {
  dataset: Awaited<ReturnType<typeof import("@/lib/data/admin").fetchAdminDashboardDataset>>;
  activeView: string;
}) => {
  const {
    metricsRes,
    assignmentOversightRes,
    moderationOverviewRes,
    recentActivityRes,
    institution,
    profiles,
    assignments,
    submissions,
    moderationCases,
    adminAuditRes,
    gradeAuditRes,
    academicAccessEventsRes,
    integrityReviewsRes,
    latestGradeRes,
    workflowRunRes,
    workflowNotificationLogRes,
    gradingFailureCountRes,
  } = dataset;

  const users: AdminUserRow[] = profiles.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: parseAppRole(row.role) ?? "student",
    departmentName: getDepartmentName(row),
    cohortId: row.cohort_id ?? null,
    mustChangePassword: row.must_change_password ?? false,
    createdAt: row.created_at ?? null,
  }));

  const lecturerNameById = new Map(
    users.map((row) => [row.id, row.fullName || row.email || "Unknown lecturer"]),
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

  const assignmentRows = rpcAssignmentRows ?? assignments.map((row) => {
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

  const moderationRows = rpcModerationRows ?? moderationCases.map((row) => ({
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
    if (adminAuditRes.error) throw adminAuditRes.error;
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
    log.warn("Admin audit log is unavailable", { view: "audit" });
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
  let workflowRunTelemetryAvailable = false;
  let workflowRunRows: Array<{
    id: string;
    created_at: string;
    started_at: string;
    finished_at: string | null;
    duration_ms: number | null;
    workflow_name: string;
    status: "failed" | "running" | "succeeded";
    provider: string;
    model: string | null;
    retry_count: number;
    failure_category: string | null;
  }> = [];
  let latestGradeRun: string | null = null;
  let aiGradingFailures: number | null = null;
  let workflowNotificationTelemetryAvailable = false;
  let workflowNotificationRows: Array<{
    id: string;
    created_at: string;
    delivery_status: string;
    sent_at: string | null;
    last_error: string | null;
  }> = [];
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
    if (gradeAuditRes.error) throw gradeAuditRes.error;
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
  } catch {
    log.warn("Grade workflow audit is unavailable to admin", { view: "system" });
  }

  if (gradingFailureCountRes.error) {
    log.warn("Grading error telemetry is unavailable to admin dashboard", { view: "system" });
  } else {
    aiGradingFailures = gradingFailureCountRes.count ?? 0;
  }

  try {
    if (latestGradeRes.error) throw latestGradeRes.error;
    latestGradeRun = latestGradeRes.data?.[0]?.created_at ?? null;
  } catch {
    log.warn("Grades are unavailable to admin dashboard", { view: "system" });
  }

  try {
    if (workflowRunRes.error) throw workflowRunRes.error;
    workflowRunTelemetryAvailable = true;
    workflowRunRows = (workflowRunRes.data || []).map((row) => ({
      id: row.id,
      created_at: row.created_at,
      started_at: row.started_at,
      finished_at: row.finished_at ?? null,
      duration_ms: row.duration_ms ?? null,
      workflow_name: row.workflow_name,
      status: row.status,
      provider: row.provider,
      model: row.model ?? null,
      retry_count: row.retry_count ?? 0,
      failure_category: row.failure_category ?? null,
    }));
  } catch {
    log.warn("Workflow run telemetry is unavailable to admin dashboard", { view: "system" });
  }

  try {
    if (workflowNotificationLogRes.error) throw workflowNotificationLogRes.error;
    workflowNotificationTelemetryAvailable = true;
    workflowNotificationRows = (workflowNotificationLogRes.data || []).map((row) => ({
      id: row.id,
      created_at: row.created_at,
      delivery_status: row.delivery_status,
      sent_at: row.sent_at ?? null,
      last_error: row.last_error ?? null,
    }));
  } catch {
    log.warn("Workflow notification delivery telemetry is unavailable to admin dashboard", { view: "system" });
  }

  try {
    if (academicAccessEventsRes.error) throw academicAccessEventsRes.error;
    academicAccessEventsAvailable = true;
    academicAccessEvents = academicAccessEventsRes.data || [];
  } catch {
    log.warn("Academic access events are unavailable to admin dashboard", { view: "data-access-log" });
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
    if (integrityReviewsRes.error) throw integrityReviewsRes.error;
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
    log.warn("Academic integrity reviews are unavailable to admin dashboard", { view: "integrity-overview" });
  }

  const auditRows = [...adminAuditRows, ...workflowAuditRows]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 25);
  const dataAccessLogRows = buildDataAccessLogRows({
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
  const integrityOverview = integrityReviewsAvailable
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

  const pendingModerationCases = moderationRows.filter((row) =>
    row.status === "moderation_pending" || row.status === "moderation_in_progress" || row.status === "escalated",
  ).length;
  const highIntegrityRiskCases = moderationRows.filter((row) => (row.integrityRiskScore ?? 0) >= 70 || row.status === "escalated").length;
  const rpcMetrics = metricsRes.error ? null : metricsRes.data?.[0] ?? null;

  if (metricsRes.error) {
    log.warn("Admin metrics RPC is unavailable; falling back to client-side snapshot counts", {
      view: activeView,
    });
  }

  const monitoringSnapshot = buildOperationalMonitoringSnapshot({
    workflowRunTelemetryAvailable,
    workflowRunRows: workflowRunRows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      durationMs: row.duration_ms,
      workflowName: row.workflow_name,
      status: row.status,
      provider: row.provider,
      model: row.model,
      retryCount: row.retry_count,
      failureCategory: row.failure_category,
    })),
    latestGradeRun,
    aiGradingFailures,
    moderationRows,
    submissions: submissionRows,
    workflowNotificationTelemetryAvailable,
    workflowNotificationRows: workflowNotificationRows.map((row) => ({
      deliveryStatus: row.delivery_status,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      lastError: row.last_error,
    })),
  });

  return {
    institution,
    users,
    assignments: assignmentRows,
    submissions: submissionRows,
    moderationRows,
    auditRows,
    dataAccessLogRows,
    dataAccessLogStatus: toGovernanceStatus(adminAuditAvailable || gradeAuditAvailable || academicAccessEventsAvailable, dataAccessLogRows.length),
    integrityOverview,
    moderationAuditRows,
    moderationAuditStatus: toGovernanceStatus(true, moderationAuditRows.length),
    policyExceptionRows,
    policyExceptionStatus:
      integrityReviewsAvailable
        ? toGovernanceStatus(true, policyExceptionRows.length)
        : policyExceptionRows.length > 0
          ? ("available" as AdminGovernanceStatus)
          : ("unavailable" as AdminGovernanceStatus),
    metrics: {
      totalUsers: rpcMetrics?.total_users ?? users.length,
      activeLecturers: rpcMetrics?.active_lecturers ?? users.filter((row) => row.role === "lecturer").length,
      activeStudents: rpcMetrics?.active_students ?? users.filter((row) => row.role === "student").length,
      totalAssignments: rpcMetrics?.total_assignments ?? assignmentRows.length,
      totalSubmissions: rpcMetrics?.total_submissions ?? submissionRows.length,
      pendingModerationCases: rpcMetrics?.pending_moderation_cases ?? pendingModerationCases,
      aiGradingFailures,
      highIntegrityRiskCases: rpcMetrics?.high_integrity_risk_cases ?? highIntegrityRiskCases,
    } satisfies AdminMetrics,
    healthItems: monitoringSnapshot.healthItems.map((item) => ({
      ...item,
      statusLabel:
        item.label === "Latest visible grading activity" && latestGradeRun
          ? safeFormatDate(latestGradeRun, "MMM d, HH:mm", "Recorded")
          : item.statusLabel,
      detail:
        item.label === "Latest visible grading activity" && latestGradeRun
          ? item.tone === "warning"
            ? `${item.detail} The latest visible grade row was recorded ${safeFormatDate(latestGradeRun, "MMM d, yyyy HH:mm", "recently")}.`
            : `Latest grading evidence visible to admin was recorded ${safeFormatDate(latestGradeRun, "MMM d, yyyy HH:mm", "recently")}. This is an observed grading timestamp, not a live service heartbeat.`
          : item.detail,
    })),
    failureCards: monitoringSnapshot.failureCards,
    alertCards: monitoringSnapshot.alertCards,
    activityFeed:
      rpcActivityFeed ??
      buildActivityFeed({
        assignments: assignmentRows,
        submissions: submissionRows,
        moderationRows,
        auditRows,
      }),
  };
};
