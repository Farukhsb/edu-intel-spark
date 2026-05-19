import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { fetchAdminDashboardDataset } from "@/lib/data/admin";
import { log } from "@/lib/logger";
import { parseAdminDashboardSearchState } from "@/lib/schemas/navigation";

import { runManagedProfileSave, runRoleChange, runRoleMetadataSync } from "./controllers/actions";
import { buildAdminDashboardData, EMPTY_INTEGRITY_OVERVIEW, EMPTY_METRICS } from "./controllers/dashboardData";
import { buildAdminDashboardViewModel } from "./controllers/viewModel";
import type {
  AdminDashboardControllerResult,
  AdminDashboardState,
  AdminManagedProfileInput,
  AdminUserRow,
  AdminView,
  PendingRoleChange,
  SelectedUserPreview,
} from "./types";

export const useAdminDashboardController = () => {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const adminSearchState = parseAdminDashboardSearchState(searchParams);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [healthItems, setHealthItems] = useState<AdminDashboardState["healthItems"]>([]);
  const [failureCards, setFailureCards] = useState<AdminDashboardState["failureCards"]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [assignments, setAssignments] = useState<AdminDashboardState["assignments"]>([]);
  const [submissions, setSubmissions] = useState<AdminDashboardState["submissions"]>([]);
  const [moderationRows, setModerationRows] = useState<AdminDashboardState["moderationRows"]>([]);
  const [auditRows, setAuditRows] = useState<AdminDashboardState["auditRows"]>([]);
  const [activityFeed, setActivityFeed] = useState<AdminDashboardState["activityFeed"]>([]);
  const [dataAccessLogRows, setDataAccessLogRows] = useState<AdminDashboardState["dataAccessLogRows"]>([]);
  const [dataAccessLogStatus, setDataAccessLogStatus] = useState<AdminDashboardState["dataAccessLogStatus"]>("empty");
  const [integrityOverview, setIntegrityOverview] = useState(EMPTY_INTEGRITY_OVERVIEW);
  const [moderationAuditRows, setModerationAuditRows] = useState<AdminDashboardState["moderationAuditRows"]>([]);
  const [moderationAuditStatus, setModerationAuditStatus] = useState<AdminDashboardState["moderationAuditStatus"]>("empty");
  const [policyExceptionRows, setPolicyExceptionRows] = useState<AdminDashboardState["policyExceptionRows"]>([]);
  const [policyExceptionStatus, setPolicyExceptionStatus] = useState<AdminDashboardState["policyExceptionStatus"]>("empty");
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange>(null);
  const [changingUserId, setChangingUserId] = useState<string | null>(null);
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);
  const [selectedUserPreview, setSelectedUserPreview] = useState<SelectedUserPreview>(null);
  const [editingUserProfile, setEditingUserProfile] = useState<SelectedUserPreview>(null);
  const [savingUserProfileId, setSavingUserProfileId] = useState<string | null>(null);

  const activeView = useMemo<AdminView>(() => adminSearchState.view, [adminSearchState.view]);
  const activeUserFilter = useMemo(
    () => (adminSearchState.userFilter === "lecturer" || adminSearchState.userFilter === "student" ? adminSearchState.userFilter : null),
    [adminSearchState.userFilter],
  );

  const loadAdminDashboard = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!silent) {
      setLoading(true);
      setLoadError(null);
    } else {
      setRefreshing(true);
    }

    try {
      const dataset = await fetchAdminDashboardDataset();
      const nextData = buildAdminDashboardData({ dataset, activeView });

      setUsers(nextData.users);
      setAssignments(nextData.assignments);
      setSubmissions(nextData.submissions);
      setModerationRows(nextData.moderationRows);
      setAuditRows(nextData.auditRows);
      setActivityFeed(nextData.activityFeed);
      setDataAccessLogRows(nextData.dataAccessLogRows);
      setDataAccessLogStatus(nextData.dataAccessLogStatus);
      setIntegrityOverview(nextData.integrityOverview);
      setModerationAuditRows(nextData.moderationAuditRows);
      setModerationAuditStatus(nextData.moderationAuditStatus);
      setPolicyExceptionRows(nextData.policyExceptionRows);
      setPolicyExceptionStatus(nextData.policyExceptionStatus);
      setMetrics(nextData.metrics);
      setHealthItems(nextData.healthItems);
      setFailureCards(nextData.failureCards);
    } catch (error) {
      log.error("Failed to load admin dashboard", error, {
        view: activeView,
      });
      setLoadError("Admin dashboard data could not be loaded right now.");
      toast.error("Admin dashboard data could not be loaded right now.");
    } finally {
      if (!silent) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
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
      await runRoleChange({
        pendingRoleChange,
        reload: () => loadAdminDashboard({ silent: true }),
        close: () => setPendingRoleChange(null),
      });
    } finally {
      setChangingUserId(null);
    }
  };

  const syncUserRoleMetadata = async (targetUser: AdminUserRow) => {
    setSyncingUserId(targetUser.id);
    try {
      await runRoleMetadataSync({
        targetUser,
        reload: () => loadAdminDashboard({ silent: true }),
      });
    } finally {
      setSyncingUserId(null);
    }
  };

  const saveUserProfile = async (input: AdminManagedProfileInput) => {
    setSavingUserProfileId(input.targetUserId);
    try {
      await runManagedProfileSave({
        input,
        reload: () => loadAdminDashboard({ silent: true }),
        close: () => setEditingUserProfile(null),
      });
    } finally {
      setSavingUserProfileId(null);
    }
  };

  const state = {
    loading,
    refreshing,
    loadError,
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
    editingUserProfile,
    savingUserProfileId,
  } satisfies AdminDashboardState;

  const viewModel = buildAdminDashboardViewModel(state);

  return {
    profile,
    status: {
      loading,
      refreshing,
      loadError,
    },
    viewModel,
    actions: {
      loadAdminDashboard,
      requestRoleChange,
      confirmRoleChange,
      syncUserRoleMetadata,
      saveUserProfile,
      setPendingRoleChange,
      setSelectedUserPreview,
      setEditingUserProfile,
    },
  } satisfies AdminDashboardControllerResult;
};
