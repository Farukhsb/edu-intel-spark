import { useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchAdminDashboardDataset } from "@/lib/data/admin";
import { safeFormatDate } from "@/lib/date";
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
import { buildDataAccessLogRows } from "./controllers/accessLog";
import { toGovernanceStatus } from "./controllers/governance";
import { buildIntegrityOverview } from "./controllers/integrityOverview";
import { buildModerationAuditRows, buildPolicyExceptionRows } from "./controllers/moderationAudit";

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
        gradingFailureCountRes,
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

        aiGradingFailures = gradingFailureCountRes.error ? null : gradingFailureCountRes.count ?? 0;
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
