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
  role: string;
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

export type AdminView = "overview" | "users" | "system" | "assignments" | "submissions" | "audit";

export type PendingRoleChange = {
  userId: string;
  fullName: string | null;
  currentRole: string;
  nextRole: "student" | "lecturer";
} | null;

export type SelectedUserPreview = AdminUserRow | null;

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
  metrics: AdminMetrics;
  healthItems: OperationalHealthItem[];
  failureCards: OperationalFailureCard[];
  users: AdminUserRow[];
  assignments: AdminAssignmentRow[];
  submissions: AdminSubmissionRow[];
  moderationRows: AdminModerationRow[];
  auditRows: AdminAuditRow[];
  activityFeed: ActivityItem[];
  activeView: AdminView;
  activeUserFilter: "lecturer" | "student" | null;
  visibleUsers: AdminUserRow[];
  pendingRoleChange: PendingRoleChange;
  changingUserId: string | null;
  syncingUserId: string | null;
  selectedUserPreview: SelectedUserPreview;
};
