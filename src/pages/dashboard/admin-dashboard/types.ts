import type { Dispatch, SetStateAction } from "react";
import type { AppRole } from "@/lib/roles";
import type { LucideIcon } from "lucide-react";
import type {
  OperationalFailureCard,
  OperationalHealthItem,
} from "@/lib/operationalMonitoring";

export type AdminMetrics = {
  totalUsers: number;
  activeLecturers: number;
  activeStudents: number;
  totalAssignments: number;
  totalSubmissions: number;
  pendingModerationCases: number;
  aiGradingFailures: number | null;
  highIntegrityRiskCases: number;
};

export type AdminUserRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  role: AppRole;
  departmentName: string | null;
  cohortId: string | null;
  mustChangePassword: boolean;
  createdAt: string | null;
};

export type AdminAssignmentRow = {
  id: string;
  title: string;
  moduleCode: string | null;
  lecturerName: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
  submissionCount: number;
  gradedCount: number;
  releasedCount: number;
};

export type AdminSubmissionRow = {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  studentLabel: string;
  status: string;
  submittedAt: string;
  fileName: string;
};

export type AdminModerationRow = {
  id: string;
  assignmentTitle: string;
  firstMarkerName: string;
  moderatorName: string;
  status: string;
  integrityRiskScore: number | null;
  confidenceScore: number | null;
  createdAt: string;
  updatedAt: string;
  triggerSummary: string | null;
  disagreement: boolean;
};

export type AdminAuditRow = {
  id: string;
  createdAt: string;
  actorName: string;
  action: string;
  target: string;
  detail: string;
  source: "admin" | "workflow";
};

export type AdminGovernanceStatus = "available" | "empty" | "unavailable";

export type AdminDataAccessLogRow = {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceLabel: string;
  outcome: string;
  details: string;
  source: "admin" | "workflow" | "academic-access";
};

export type AdminIntegrityEventRow = {
  id: string;
  reviewedAt: string;
  assignmentTitle: string;
  studentLabel: string;
  decision: string;
  riskScore: number | null;
  similarityScore: number | null;
  flags: string[];
  latestNote: string;
};

export type AdminIntegrityAssignmentSummaryRow = {
  assignmentId: string;
  assignmentTitle: string;
  totalReviews: number;
  flaggedReviews: number;
  highRiskCases: number;
};

export type AdminIntegrityOverview = {
  totalReviews: number;
  flaggedReviews: number;
  highRiskCases: number;
  averageSimilarityScore: number | null;
  assignmentsWithMostConcerns: AdminIntegrityAssignmentSummaryRow[];
  recentEvents: AdminIntegrityEventRow[];
  status: AdminGovernanceStatus;
};

export type AdminModerationAuditRow = {
  id: string;
  assignmentTitle: string;
  studentLabel: string;
  assignedModerator: string;
  status: string;
  decision: string;
  historySummary: string;
  noteSummary: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminPolicyExceptionRow = {
  id: string;
  type: string;
  severity: "high" | "medium";
  assignmentTitle: string;
  studentLabel: string;
  status: string;
  detectedAt: string;
  details: string;
};

export type ActivityItem = {
  id: string;
  createdAt: string;
  title: string;
  detail: string;
  tone: "neutral" | "warning" | "success";
};

export type AdminOverviewCard = {
  title: string;
  value: string;
  helper: string;
  href?: string;
  icon: LucideIcon;
};

export type AdminView =
  | "overview"
  | "users"
  | "system"
  | "assignments"
  | "submissions"
  | "moderation"
  | "audit"
  | "data-access-log"
  | "integrity-overview"
  | "moderation-audit"
  | "policy-exceptions";

export type PendingRoleChange = {
  userId: string;
  fullName: string | null;
  currentRole: string;
  nextRole: "student" | "lecturer";
} | null;

export type SelectedUserPreview = AdminUserRow | null;

export type EditingUserProfile = AdminUserRow | null;

export type AdminManagedProfileInput = {
  targetUserId: string;
  fullName: string;
  role: AppRole;
  departmentName: string | null;
  cohortId: string | null;
  mustChangePassword: boolean;
};

export type AssignmentSubmissionSummary = {
  submissionCount: number;
  gradedCount: number;
  releasedCount: number;
};

export type ModerationSummary = {
  highRisk: number;
  awaitingLecturer: number;
  assignedModerators: number;
  overdue: number;
  disagreements: number;
};

export type AdminDashboardState = {
  loading: boolean;
  refreshing: boolean;
  loadError: string | null;
  metrics: AdminMetrics;
  healthItems: OperationalHealthItem[];
  failureCards: OperationalFailureCard[];
  users: AdminUserRow[];
  assignments: AdminAssignmentRow[];
  submissions: AdminSubmissionRow[];
  moderationRows: AdminModerationRow[];
  auditRows: AdminAuditRow[];
  activityFeed: ActivityItem[];
  dataAccessLogRows: AdminDataAccessLogRow[];
  dataAccessLogStatus: AdminGovernanceStatus;
  integrityOverview: AdminIntegrityOverview;
  moderationAuditRows: AdminModerationAuditRow[];
  moderationAuditStatus: AdminGovernanceStatus;
  policyExceptionRows: AdminPolicyExceptionRow[];
  policyExceptionStatus: AdminGovernanceStatus;
  activeView: AdminView;
  activeUserFilter: "lecturer" | "student" | null;
  visibleUsers: AdminUserRow[];
  pendingRoleChange: PendingRoleChange;
  changingUserId: string | null;
  syncingUserId: string | null;
  selectedUserPreview: SelectedUserPreview;
  editingUserProfile: EditingUserProfile;
  savingUserProfileId: string | null;
};

export type AdminDashboardStatus = Pick<AdminDashboardState, "loading" | "refreshing" | "loadError">;

export type AdminDashboardViewModel = {
  activeView: AdminView;
  header: {
    refreshing: boolean;
    showBulkUpload: boolean;
  };
  overview: {
    metrics: AdminMetrics;
    healthItems: OperationalHealthItem[];
    failureCards: OperationalFailureCard[];
    users: AdminUserRow[];
    assignments: AdminAssignmentRow[];
    submissions: AdminSubmissionRow[];
    moderationRows: AdminModerationRow[];
    auditRows: AdminAuditRow[];
    activityFeed: ActivityItem[];
  };
  users: {
    users: AdminUserRow[];
    changingUserId: string | null;
    syncingUserId: string | null;
  };
  assignments: {
    assignments: AdminAssignmentRow[];
  };
  submissions: {
    submissions: AdminSubmissionRow[];
  };
  moderation: {
    moderationRows: AdminModerationRow[];
  };
  audit: {
    auditRows: AdminAuditRow[];
    activityFeed: ActivityItem[];
  };
  dataAccessLog: {
    rows: AdminDataAccessLogRow[];
    status: AdminGovernanceStatus;
  };
  integrityOverview: {
    overview: AdminIntegrityOverview;
  };
  moderationAudit: {
    rows: AdminModerationAuditRow[];
    status: AdminGovernanceStatus;
  };
  policyExceptions: {
    rows: AdminPolicyExceptionRow[];
    status: AdminGovernanceStatus;
  };
  system: {
    failureCards: OperationalFailureCard[];
    healthItems: OperationalHealthItem[];
    moderationRows: AdminModerationRow[];
    activityFeed: ActivityItem[];
  };
  dialogs: {
    pendingRoleChange: PendingRoleChange;
    changingUserId: string | null;
    selectedUserPreview: SelectedUserPreview;
    editingUserProfile: EditingUserProfile;
    savingUserProfileId: string | null;
  };
};

export type AdminDashboardActions = {
  loadAdminDashboard: (options?: { silent?: boolean }) => Promise<void>;
  requestRoleChange: (user: AdminUserRow, nextRole: "student" | "lecturer") => void;
  confirmRoleChange: () => Promise<void>;
  syncUserRoleMetadata: (targetUser: AdminUserRow) => Promise<void>;
  saveUserProfile: (input: AdminManagedProfileInput) => Promise<void>;
  setPendingRoleChange: Dispatch<SetStateAction<PendingRoleChange>>;
  setSelectedUserPreview: Dispatch<SetStateAction<SelectedUserPreview>>;
  setEditingUserProfile: Dispatch<SetStateAction<SelectedUserPreview>>;
};

export type AdminDashboardControllerResult = {
  profile: {
    id: string;
    role: AppRole;
  } | null;
  status: AdminDashboardStatus;
  viewModel: AdminDashboardViewModel;
  actions: AdminDashboardActions;
};
