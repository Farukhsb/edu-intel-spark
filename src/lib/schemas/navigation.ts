import { z } from "zod";

const NonEmptyIdSchema = z.string().trim().min(1);

const ExplainGradeSourceSchema = z.enum(["notification", "email", "assignment-detail"]);
const AssignmentNotificationFocusSchema = z.enum([
  "submission-review",
  "ai-results",
  "integrity-review",
  "release-follow-up",
]);
const AssignmentQueueFocusSchema = z.enum([
  "manual-review",
  "release-ready",
  "released-results",
]);
const AssignmentStatusFilterSchema = z.enum(["draft", "published", "closed"]);
const AssignmentListViewSchema = z.enum(["needs-review"]);
const AdminViewSchema = z.enum([
  "overview",
  "users",
  "system",
  "assignments",
  "submissions",
  "moderation",
  "audit",
  "data-access-log",
  "integrity-overview",
  "moderation-audit",
  "policy-exceptions",
]);
const AdminUserFilterSchema = z.enum(["student", "lecturer", "admin"]);
const PerformanceRiskFilterSchema = z.enum(["all", "high-plus", "critical", "high", "moderate"]);
const PerformanceScoreBandFilterSchema = z.enum(["all", "lt40", "40-49", "50-59", "60plus"]);

export type ExplainGradeSource = z.infer<typeof ExplainGradeSourceSchema>;
export type AssignmentNotificationFocusValue = z.infer<typeof AssignmentNotificationFocusSchema>;
export type AssignmentQueueFocusValue = z.infer<typeof AssignmentQueueFocusSchema>;
export type AssignmentStatusFilterValue = z.infer<typeof AssignmentStatusFilterSchema>;
export type AssignmentListViewValue = z.infer<typeof AssignmentListViewSchema>;
export type AdminViewValue = z.infer<typeof AdminViewSchema>;
export type AdminUserFilterValue = z.infer<typeof AdminUserFilterSchema>;
export type PerformanceRiskFilterValue = z.infer<typeof PerformanceRiskFilterSchema>;
export type PerformanceScoreBandFilterValue = z.infer<typeof PerformanceScoreBandFilterSchema>;

export interface ExplainGradeSearchState {
  assignmentId: string | null;
  submissionId: string | null;
  source: ExplainGradeSource | null;
}

export interface AssignmentDetailSearchState {
  moderationReleaseFocus: boolean;
  notificationFocus: AssignmentNotificationFocusValue | null;
  queueFocus: AssignmentQueueFocusValue | null;
}

export interface AssignmentsSearchState {
  statusFilter: AssignmentStatusFilterValue | "all";
  view: AssignmentListViewValue | null;
}

export interface AdminDashboardSearchState {
  view: AdminViewValue;
  userFilter: AdminUserFilterValue | null;
}

export interface PerformanceTrendsSearchState {
  riskFilter: PerformanceRiskFilterValue;
  scoreBandFilter: PerformanceScoreBandFilterValue;
}

const parseOptionalId = (value: string | null) => {
  const result = NonEmptyIdSchema.safeParse(value);
  return result.success ? result.data : null;
};

export const parseExplainGradeSearchState = (
  searchParams: URLSearchParams,
): ExplainGradeSearchState => {
  const sourceResult = ExplainGradeSourceSchema.safeParse(searchParams.get("source"));

  return {
    assignmentId: parseOptionalId(searchParams.get("assignment")),
    submissionId: parseOptionalId(searchParams.get("submission")),
    source: sourceResult.success ? sourceResult.data : null,
  };
};

export const parseAssignmentDetailSearchState = (
  searchParams: URLSearchParams,
): AssignmentDetailSearchState => {
  const source = searchParams.get("source");
  const focus = searchParams.get("focus");
  const notificationFocus = AssignmentNotificationFocusSchema.safeParse(focus);
  const queueFocus = AssignmentQueueFocusSchema.safeParse(focus);

  return {
    moderationReleaseFocus: source === "moderation" && focus === "release-ready",
    notificationFocus:
      source === "notification" && notificationFocus.success ? notificationFocus.data : null,
    queueFocus: source === "queue" && queueFocus.success ? queueFocus.data : null,
  };
};

export const parseAssignmentsSearchState = (
  searchParams: URLSearchParams,
): AssignmentsSearchState => {
  const statusFilter = AssignmentStatusFilterSchema.safeParse(searchParams.get("status"));
  const view = AssignmentListViewSchema.safeParse(searchParams.get("view"));

  return {
    statusFilter: statusFilter.success ? statusFilter.data : "all",
    view: view.success ? view.data : null,
  };
};

export const parseAdminDashboardSearchState = (
  searchParams: URLSearchParams,
): AdminDashboardSearchState => {
  const view = AdminViewSchema.safeParse(searchParams.get("view"));
  const userFilter = AdminUserFilterSchema.safeParse(searchParams.get("filter"));

  return {
    view: view.success ? view.data : "overview",
    userFilter: userFilter.success ? userFilter.data : null,
  };
};

export const parsePerformanceTrendsSearchState = (
  searchParams: URLSearchParams,
): PerformanceTrendsSearchState => {
  const riskFilter = PerformanceRiskFilterSchema.safeParse(searchParams.get("risk"));
  const scoreBandFilter = PerformanceScoreBandFilterSchema.safeParse(searchParams.get("scoreBand"));

  return {
    riskFilter: riskFilter.success ? riskFilter.data : "all",
    scoreBandFilter: scoreBandFilter.success ? scoreBandFilter.data : "all",
  };
};
