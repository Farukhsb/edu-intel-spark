import type {
  AdminDashboardState,
  AdminDashboardViewModel,
} from "../types";
import { isBulkUploadView } from "./viewModel.helpers";

export const buildAdminDashboardViewModel = (
  state: AdminDashboardState,
): AdminDashboardViewModel => ({
  activeView: state.activeView,
  header: {
    institution: state.institution,
    refreshing: state.refreshing,
    showBulkUpload: isBulkUploadView(state.activeView),
  },
  overview: {
    metrics: state.metrics,
    lmsOverview: state.lmsOverview,
    healthItems: state.healthItems,
    failureCards: state.failureCards,
    alertCards: state.alertCards,
    users: state.users,
    assignments: state.assignments,
    submissions: state.submissions,
    moderationRows: state.moderationRows,
    auditRows: state.auditRows,
    activityFeed: state.activityFeed,
  },
  users: {
    users: state.visibleUsers,
    changingUserId: state.changingUserId,
    syncingUserId: state.syncingUserId,
  },
  assignments: {
    assignments: state.assignments,
  },
  submissions: {
    submissions: state.submissions,
  },
  moderation: {
    moderationRows: state.moderationRows,
  },
  audit: {
    auditRows: state.auditRows,
    activityFeed: state.activityFeed,
  },
  dataAccessLog: {
    rows: state.dataAccessLogRows,
    status: state.dataAccessLogStatus,
  },
  integrityOverview: {
    overview: state.integrityOverview,
  },
  moderationAudit: {
    rows: state.moderationAuditRows,
    status: state.moderationAuditStatus,
  },
  policyExceptions: {
    rows: state.policyExceptionRows,
    status: state.policyExceptionStatus,
  },
  system: {
    failureCards: state.failureCards,
    alertCards: state.alertCards,
    healthItems: state.healthItems,
    moderationRows: state.moderationRows,
    activityFeed: state.activityFeed,
  },
  dialogs: {
    pendingRoleChange: state.pendingRoleChange,
    changingUserId: state.changingUserId,
    selectedUserPreview: state.selectedUserPreview,
    editingUserProfile: state.editingUserProfile,
    savingUserProfileId: state.savingUserProfileId,
  },
});
