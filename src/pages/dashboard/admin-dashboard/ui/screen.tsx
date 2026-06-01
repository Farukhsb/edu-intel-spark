import { useNavigate } from "react-router-dom";

import { IntegrityModerationSection } from "./integrity-moderation-section";
import { AssignmentOversightSection } from "./assignment-oversight-section";
import { SubmissionOversightSection } from "./submission-oversight-section";
import { SystemHealthSection } from "./system-health-section";
import { UserManagementSection } from "./user-management-section";
import { DashboardHeader } from "./dashboard-header";
import {
  ComplianceHubSection,
  AuditLogSection,
  OperationalFailureSection,
  OverviewPage,
  RecentActivitySection,
} from "./dashboard-sections";
import {
  EditUserProfileDialog,
  RoleChangeDialog,
  UserSummaryDialog,
} from "./profile-management-dialogs";

import type { AdminComplianceTab, AdminDashboardActions, AdminDashboardViewModel } from "../types";

const isComplianceHubView = (value: string) =>
  value === "compliance" ||
  value === "data-access-log" ||
  value === "integrity-overview" ||
  value === "moderation-audit" ||
  value === "policy-exceptions";

const getComplianceTab = (value: string): AdminComplianceTab =>
  value === "integrity-overview" ||
  value === "moderation-audit" ||
  value === "policy-exceptions"
    ? value
    : "data-access-log";

export const AdminDashboardScreen = ({
  viewModel,
  actions,
}: {
  viewModel: AdminDashboardViewModel;
  actions: AdminDashboardActions;
}) => {
  const navigate = useNavigate();
  const {
    activeView,
    header,
    overview,
    users,
    assignments,
    submissions,
    moderation,
    audit,
    dataAccessLog,
    integrityOverview,
    moderationAudit,
    policyExceptions,
    system,
    dialogs,
  } = viewModel;

  const {
    loadAdminDashboard,
    requestRoleChange,
    confirmRoleChange,
    syncUserRoleMetadata,
    saveUserProfile,
    setPendingRoleChange,
    setSelectedUserPreview,
    setEditingUserProfile,
  } = actions;

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardHeader
        institution={header.institution}
        refreshing={header.refreshing}
      onRefresh={() => void loadAdminDashboard({ silent: true })}
      showBulkUpload={header.showBulkUpload}
    />

      {isComplianceHubView(activeView) ? (
        <ComplianceHubSection
          activeTab={getComplianceTab(activeView)}
          dataAccessLog={dataAccessLog}
          integrityOverview={integrityOverview}
          moderationAudit={moderationAudit}
          onTabChange={(tab: AdminComplianceTab) => {
            navigate(`/dashboard?view=${tab}`);
          }}
          policyExceptions={policyExceptions}
        />
      ) : activeView === "users" ? (
        <UserManagementSection
          users={users.users}
          onRequestRoleChange={requestRoleChange}
          changingUserId={users.changingUserId}
          onSyncRoleMetadata={syncUserRoleMetadata}
          syncingUserId={users.syncingUserId}
          onViewUser={setSelectedUserPreview}
          onEditUser={setEditingUserProfile}
        />
      ) : activeView === "assignments" ? (
        <AssignmentOversightSection assignments={assignments.assignments} />
      ) : activeView === "submissions" ? (
        <SubmissionOversightSection submissions={submissions.submissions} />
      ) : activeView === "moderation" ? (
        <IntegrityModerationSection moderationRows={moderation.moderationRows} />
      ) : activeView === "audit" ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <AuditLogSection auditRows={audit.auditRows} />
          <RecentActivitySection activityFeed={audit.activityFeed} />
        </div>
      ) : activeView === "system" ? (
        <div className="space-y-6">
          <OperationalFailureSection cards={system.failureCards} />
          <SystemHealthSection items={system.healthItems} />
          <IntegrityModerationSection moderationRows={system.moderationRows} />
          <RecentActivitySection activityFeed={system.activityFeed} />
        </div>
      ) : (
        <OverviewPage
          metrics={overview.metrics}
          healthItems={overview.healthItems}
          failureCards={overview.failureCards}
          users={overview.users}
          assignments={overview.assignments}
          submissions={overview.submissions}
          moderationRows={overview.moderationRows}
          auditRows={overview.auditRows}
          activityFeed={overview.activityFeed}
          onRequestRoleChange={requestRoleChange}
          changingUserId={dialogs.changingUserId}
          onSyncRoleMetadata={syncUserRoleMetadata}
          syncingUserId={users.syncingUserId}
          onViewUser={setSelectedUserPreview}
          onEditUser={setEditingUserProfile}
        />
      )}

      <RoleChangeDialog
        pendingRoleChange={dialogs.pendingRoleChange}
        changingUserId={dialogs.changingUserId}
        refreshing={header.refreshing}
        onOpenChange={(open) => !open && setPendingRoleChange(null)}
        onConfirm={() => {
          void confirmRoleChange();
        }}
      />

      <UserSummaryDialog
        user={dialogs.selectedUserPreview}
        onOpenChange={(open) => !open && setSelectedUserPreview(null)}
      />

      <EditUserProfileDialog
        user={dialogs.editingUserProfile}
        saving={dialogs.savingUserProfileId === dialogs.editingUserProfile?.id}
        onOpenChange={(open) => !open && setEditingUserProfile(null)}
        onSave={(input) => {
          void saveUserProfile(input);
        }}
      />
    </div>
  );
};
