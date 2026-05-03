import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FunctionsHttpError } from "@supabase/supabase-js";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookCopy,
  CheckCircle2,
  Clock3,
  FileOutput,
  GraduationCap,
  Loader2,
  Mail,
  RefreshCw,
  Scale,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { safeFormatDate } from "@/lib/date";
import { log } from "@/lib/logger";
import { toast } from "sonner";

type AdminMetrics = {
  totalUsers: number;
  activeLecturers: number;
  activeStudents: number;
  totalAssignments: number;
  totalSubmissions: number;
  pendingModerationCases: number;
  aiGradingFailures: number | null;
  highIntegrityRiskCases: number;
};

type AdminUserRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  role: string;
  createdAt: string | null;
};

type AdminAssignmentRow = {
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

type AdminSubmissionRow = {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  studentLabel: string;
  status: string;
  submittedAt: string;
  fileName: string;
};

type AdminModerationRow = {
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

type AdminAuditRow = {
  id: string;
  createdAt: string;
  actorName: string;
  action: string;
  target: string;
  detail: string;
  source: "admin" | "workflow";
};

type AdminHealthItem = {
  label: string;
  statusLabel: string;
  tone: "healthy" | "warning" | "placeholder";
  detail: string;
};

type ActivityItem = {
  id: string;
  createdAt: string;
  title: string;
  detail: string;
  tone: "neutral" | "warning" | "success";
};

type AdminOverviewCard = {
  title: string;
  value: string;
  helper: string;
  href?: string;
  icon: typeof Users;
};

type AdminView = "overview" | "users" | "system" | "assignments" | "submissions" | "audit";

type PendingRoleChange = {
  userId: string;
  fullName: string | null;
  currentRole: string;
  nextRole: "student" | "lecturer";
} | null;

type SelectedUserPreview = AdminUserRow | null;

type AssignmentSubmissionSummary = {
  submissionCount: number;
  gradedCount: number;
  releasedCount: number;
};

type ModerationSummary = {
  highRisk: number;
  awaitingLecturer: number;
  assignedModerators: number;
  overdue: number;
  disagreements: number;
};

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

const ROLE_BADGE_STYLES: Record<string, string> = {
  admin: "border-primary/30 bg-primary/10 text-primary",
  lecturer: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  student: "border-sky-500/30 bg-sky-500/10 text-sky-700",
};

const ASSIGNMENT_STATUS_BADGE_STYLES: Record<string, string> = {
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  draft: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  closed: "border-slate-500/30 bg-slate-500/10 text-slate-700",
};

const SUBMISSION_STATUS_BADGE_STYLES: Record<string, string> = {
  submitted: "border-sky-500/30 bg-sky-500/10 text-sky-700",
  ai_grading: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700",
  ai_graded: "border-violet-500/30 bg-violet-500/10 text-violet-700",
  under_review: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  moderation_pending: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  moderation_in_progress: "border-orange-500/30 bg-orange-500/10 text-orange-700",
  moderated: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  escalated: "border-rose-500/30 bg-rose-500/10 text-rose-700",
  released: "border-primary/30 bg-primary/10 text-primary",
};

const MODERATION_STATUS_BADGE_STYLES: Record<string, string> = {
  moderation_pending: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  moderation_in_progress: "border-orange-500/30 bg-orange-500/10 text-orange-700",
  moderated: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  escalated: "border-rose-500/30 bg-rose-500/10 text-rose-700",
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

const PAGE_SIZE = 8;
const FULL_TABLE_PAGE_SIZE = 10;

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

const formatCount = (value: number | null) => (value == null ? "Pending" : String(value));

const formatPercentage = (value: number | null) => (value == null ? "Pending" : `${Math.round(value)}%`);

const humanizeToken = (value: string) => value.split("_").join(" ");

const normalizeSearchValue = (value: string) => value.trim().toLowerCase();

const isRecentEnoughToBeOverdue = (value: string) => {
  const ageMs = Date.now() - new Date(value).getTime();
  return ageMs > 1000 * 60 * 60 * 24 * 7;
};

const toStatusBadgeClass = (value: string, lookup: Record<string, string>) =>
  lookup[value] || "border-muted bg-muted/40 text-foreground";

const paginateRows = <T,>(rows: T[], page: number, pageSize: number) => rows.slice((page - 1) * pageSize, page * pageSize);

const PaginationControls = ({
  page,
  totalPages,
  itemLabel,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}) => {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/60 px-6 py-4">
      <p className="text-sm text-muted-foreground">
        {itemLabel} page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
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

const summarizeModerationRows = (moderationRows: AdminModerationRow[]): ModerationSummary =>
  moderationRows.reduce<ModerationSummary>(
    (summary, item) => {
      if ((item.integrityRiskScore ?? 0) >= 70) {
        summary.highRisk += 1;
      }
      if (item.status === "moderation_pending") {
        summary.awaitingLecturer += 1;
      }
      if (item.moderatorName !== "Unassigned") {
        summary.assignedModerators += 1;
      }
      if (item.status !== "moderated" && item.status !== "resolved" && isRecentEnoughToBeOverdue(item.createdAt)) {
        summary.overdue += 1;
      }
      if (item.disagreement) {
        summary.disagreements += 1;
      }

      return summary;
    },
    {
      highRisk: 0,
      awaitingLecturer: 0,
      assignedModerators: 0,
      overdue: 0,
      disagreements: 0,
    },
  );

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

const DashboardHeader = ({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) => (
  <Card className="border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.16),hsl(var(--primary)/0.05)_42%,transparent)] shadow-sm">
    <CardContent className="flex flex-col gap-5 p-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/25 bg-background/70">
            Admin Workspace
          </Badge>
          <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Platform Oversight</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold font-display tracking-tight md:text-3xl">GradeAI Admin Dashboard</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Monitor platform health, academic workflow progress, integrity risk, moderation load, and protected role activity
            without borrowing the lecturer workflow.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh snapshot
        </Button>
      </div>
    </CardContent>
  </Card>
);

const OverviewCards = ({
  metrics,
}: {
  metrics: AdminMetrics;
}) => {
  const navigate = useNavigate();
  const cards: AdminOverviewCard[] = [
    {
      title: "Total Users",
      value: String(metrics.totalUsers),
      helper: "Platform-wide visible accounts.",
      href: "/dashboard?view=users",
      icon: Users,
    },
    {
      title: "Active Lecturers",
      value: String(metrics.activeLecturers),
      helper: "Academic staff accounts currently active.",
      href: "/dashboard?view=users&filter=lecturer",
      icon: GraduationCap,
    },
    {
      title: "Active Students",
      value: String(metrics.activeStudents),
      helper: "Student profiles visible to admin.",
      href: "/dashboard?view=users&filter=student",
      icon: Users,
    },
    {
      title: "Assignments",
      value: String(metrics.totalAssignments),
      helper: "Draft and published assignment records.",
      href: "/dashboard?view=assignments",
      icon: BookCopy,
    },
    {
      title: "Submissions",
      value: String(metrics.totalSubmissions),
      helper: "All submission rows across the platform.",
      href: "/dashboard?view=submissions",
      icon: FileOutput,
    },
    {
      title: "Pending Moderation",
      value: String(metrics.pendingModerationCases),
      helper: "Cases still awaiting academic resolution.",
      href: "/dashboard?view=system",
      icon: Scale,
    },
    {
      title: "AI Grading Failures",
      value: formatCount(metrics.aiGradingFailures),
      helper: "Marked as placeholder until failure events are fully exposed to admins.",
      href: "/dashboard?view=system",
      icon: AlertTriangle,
    },
    {
      title: "High Integrity Risk",
      value: String(metrics.highIntegrityRiskCases),
      helper: "Cases with elevated integrity risk or escalation signals.",
      href: "/dashboard?view=system",
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((item) => {
        const card = (
          <Card className="border-border/70 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.title}</p>
                <p className="text-3xl font-bold font-display tracking-tight">{item.value}</p>
                <p className="max-w-[15rem] text-xs leading-5 text-muted-foreground">{item.helper}</p>
                {item.href ? (
                  <p className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    View details <ArrowRight className="h-3.5 w-3.5" />
                  </p>
                ) : null}
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        );

        return item.href ? (
          <button
            key={item.title}
            type="button"
            className="w-full text-left"
            onClick={() => navigate(item.href!)}
            aria-label={`View ${item.title}`}
          >
            {card}
          </button>
        ) : (
          <div key={item.title}>{card}</div>
        );
      })}
    </div>
  );
};

const SystemHealthSection = ({
  items,
}: {
  items: AdminHealthItem[];
}) => (
  <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="text-base">System health</CardTitle>
        <CardDescription>Operational signals for the core services the platform depends on.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 p-6 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-border/70 bg-background/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{item.label}</p>
              <Badge
                variant="outline"
                className={
                  item.tone === "healthy"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                    : item.tone === "warning"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                      : "border-slate-500/30 bg-slate-500/10 text-slate-700"
                }
              >
                {item.tone === "healthy" ? <ShieldCheck className="mr-1 h-3.5 w-3.5" /> : item.tone === "warning" ? <AlertTriangle className="mr-1 h-3.5 w-3.5" /> : <Clock3 className="mr-1 h-3.5 w-3.5" />}
                {item.statusLabel}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>

    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="text-base">Admin settings posture</CardTitle>
        <CardDescription>Reserved control surface for future platform settings without changing current behavior.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-6 text-sm">
        <div className="rounded-xl border border-border/70 p-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            <p className="font-medium">AI grading controls</p>
          </div>
          <p className="mt-2 text-muted-foreground">Enabled state and thresholds should remain backend-governed until dedicated admin settings are wired.</p>
        </div>
        <div className="rounded-xl border border-border/70 p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <p className="font-medium">Integrity thresholds</p>
          </div>
          <p className="mt-2 text-muted-foreground">Similarity, AI-writing, and baseline-deviation thresholds are shown as monitored controls, not editable controls, for now.</p>
        </div>
        <div className="rounded-xl border border-border/70 p-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <p className="font-medium">Notifications and maintenance</p>
          </div>
          <p className="mt-2 text-muted-foreground">Email enablement and maintenance mode are intentionally placeholder states until a governed settings screen is introduced.</p>
        </div>
      </CardContent>
    </Card>
  </div>
);

const UserManagementSection = ({
  users,
  onRequestRoleChange,
  changingUserId,
  onViewUser,
  compact,
}: {
  users: AdminUserRow[];
  onRequestRoleChange: (user: AdminUserRow, nextRole: "student" | "lecturer") => void;
  changingUserId: string | null;
  onViewUser: (user: AdminUserRow) => void;
  compact?: boolean;
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);

    if (!normalizedQuery) {
      return users;
    }

    return users.filter((user) =>
      [user.fullName, user.email, user.role].some((value) => String(value || "").toLowerCase().includes(normalizedQuery)),
    );
  }, [query, users]);
  const totalPages = compact ? 1 : Math.max(1, Math.ceil(filteredRows.length / FULL_TABLE_PAGE_SIZE));
  const visibleRows = compact ? filteredRows.slice(0, PAGE_SIZE) : paginateRows(filteredRows, page, FULL_TABLE_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, users, compact]);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">User and role management</CardTitle>
            <CardDescription>Role changes stay narrow, confirmed, and traceable. Account status is not wired yet, so this view only confirms that a profile record exists.</CardDescription>
          </div>
          {compact ? (
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard?view=users")}>
              Open full table
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!compact ? (
          <div className="border-b border-border/60 px-6 py-4">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, email, or role"
              aria-label="Search users"
              className="max-w-sm"
            />
          </div>
        ) : null}
        {visibleRows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium">No user records are visible</p>
            <p className="mt-1 text-sm text-muted-foreground">Profiles will appear here once admin-readable account records are available.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.fullName || "Unknown user"}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email || "Not available"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`capitalize ${toStatusBadgeClass(user.role, ROLE_BADGE_STYLES)}`}
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-slate-500/30 bg-slate-500/10 text-slate-700">
                        Profile record only
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{safeFormatDate(user.createdAt, "MMM d, yyyy", "Not available")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {user.role === "student" ? (
                          <Button size="sm" variant="outline" onClick={() => onViewUser(user)}>
                            View
                          </Button>
                        ) : null}
                        {user.role === "student" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={changingUserId === user.id}
                            onClick={() => onRequestRoleChange(user, "lecturer")}
                          >
                            Promote to Lecturer
                          </Button>
                        ) : user.role === "lecturer" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={changingUserId === user.id}
                            onClick={() => onRequestRoleChange(user, "student")}
                          >
                            Demote to Student
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">No role change</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {!compact && visibleRows.length > 0 ? (
          <PaginationControls page={page} totalPages={totalPages} itemLabel="Users" onPageChange={setPage} />
        ) : null}
      </CardContent>
    </Card>
  );
};

const AssignmentOversightSection = ({
  assignments,
  compact,
}: {
  assignments: AdminAssignmentRow[];
  compact?: boolean;
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);

    if (!normalizedQuery) {
      return assignments;
    }

    return assignments.filter((assignment) =>
      [assignment.title, assignment.moduleCode, assignment.lecturerName, assignment.status]
        .some((value) => String(value || "").toLowerCase().includes(normalizedQuery)),
    );
  }, [assignments, query]);
  const totalPages = compact ? 1 : Math.max(1, Math.ceil(filteredRows.length / FULL_TABLE_PAGE_SIZE));
  const rows = compact ? filteredRows.slice(0, PAGE_SIZE) : paginateRows(filteredRows, page, FULL_TABLE_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [assignments, query, compact]);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Assignment and submission oversight</CardTitle>
            <CardDescription>Admin-safe academic progress tracking across all lecturers, without entering the grading workflow.</CardDescription>
          </div>
          {compact ? (
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard?view=assignments")}>
              Open full table
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!compact ? (
          <div className="border-b border-border/60 px-6 py-4">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by assignment, module, lecturer, or status"
              aria-label="Search assignments"
              className="max-w-sm"
            />
          </div>
        ) : null}
        {rows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium">No assignments are visible</p>
            <p className="mt-1 text-sm text-muted-foreground">Assignment oversight will appear here once records are accessible to admin.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Lecturer</TableHead>
                  <TableHead>Submissions</TableHead>
                  <TableHead>Graded</TableHead>
                  <TableHead>Released</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{assignment.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {assignment.moduleCode || "No module"}{assignment.dueDate ? ` | Due ${safeFormatDate(assignment.dueDate, "MMM d, yyyy")}` : ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{assignment.lecturerName}</TableCell>
                    <TableCell>{assignment.submissionCount}</TableCell>
                    <TableCell>{assignment.gradedCount}</TableCell>
                    <TableCell>{assignment.releasedCount}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`capitalize ${toStatusBadgeClass(assignment.status, ASSIGNMENT_STATUS_BADGE_STYLES)}`}
                      >
                        {assignment.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {!compact && rows.length > 0 ? (
          <PaginationControls page={page} totalPages={totalPages} itemLabel="Assignments" onPageChange={setPage} />
        ) : null}
      </CardContent>
    </Card>
  );
};

const IntegrityModerationSection = ({
  moderationRows,
  compact,
}: {
  moderationRows: AdminModerationRow[];
  compact?: boolean;
}) => {
  const visibleRows = compact ? moderationRows.slice(0, PAGE_SIZE) : moderationRows;
  const { highRisk, awaitingLecturer, assignedModerators, overdue, disagreements } = useMemo(
    () => summarizeModerationRows(moderationRows),
    [moderationRows],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { title: "High risk cases", value: highRisk, helper: "Integrity risk at 70% or above." },
          { title: "Awaiting lecturer review", value: awaitingLecturer, helper: "Still sitting at the first moderation stage." },
          { title: "Assigned moderators", value: assignedModerators, helper: "Cases with named moderation ownership." },
          { title: "Overdue cases", value: overdue, helper: "Open for more than seven days." },
          { title: "Marker disagreements", value: disagreements, helper: "First marker and moderator differ materially." },
        ].map((item) => (
          <Card key={item.title} className="border-border/70 shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.title}</p>
              <p className="mt-2 text-3xl font-bold font-display tracking-tight">{item.value}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base">Integrity and moderation overview</CardTitle>
          <CardDescription>Cross-platform risk and moderation monitoring for academic governance.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {visibleRows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium">No moderation cases are visible</p>
              <p className="mt-1 text-sm text-muted-foreground">High-risk and moderation queues will appear here once cases are generated.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>First marker</TableHead>
                    <TableHead>Moderator</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.assignmentTitle}</p>
                          <p className="text-xs text-muted-foreground">{item.triggerSummary || "No trigger summary recorded."}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge
                            variant="outline"
                            className={
                              (item.integrityRiskScore ?? 0) >= 70
                                ? "border-rose-500/30 bg-rose-500/10 text-rose-700"
                                : (item.integrityRiskScore ?? 0) >= 40
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                                  : "border-slate-500/30 bg-slate-500/10 text-slate-700"
                            }
                          >
                            {formatPercentage(item.integrityRiskScore)}
                          </Badge>
                          <p className="text-xs text-muted-foreground">Confidence {formatPercentage(item.confidenceScore != null ? item.confidenceScore * 100 : null)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.firstMarkerName}</TableCell>
                      <TableCell className="text-muted-foreground">{item.moderatorName}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`capitalize ${toStatusBadgeClass(item.status, MODERATION_STATUS_BADGE_STYLES)}`}
                          >
                            {humanizeToken(item.status)}
                          </Badge>
                          {item.disagreement ? (
                            <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-700">
                              Disagreement
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{safeFormatDate(item.updatedAt, "MMM d, yyyy HH:mm", "Not available")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const SubmissionOversightSection = ({
  submissions,
}: {
  submissions: AdminSubmissionRow[];
}) => {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);

    if (!normalizedQuery) {
      return submissions;
    }

    return submissions.filter((submission) =>
      [submission.assignmentTitle, submission.studentLabel, submission.fileName, submission.status]
        .some((value) => String(value || "").toLowerCase().includes(normalizedQuery)),
    );
  }, [query, submissions]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / FULL_TABLE_PAGE_SIZE));
  const visibleRows = paginateRows(filteredRows, page, FULL_TABLE_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, submissions]);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="text-base">Recent submissions</CardTitle>
        <CardDescription>Operational submission state across the platform.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-b border-border/60 px-6 py-4">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by assignment, student, file, or status"
            aria-label="Search submissions"
            className="max-w-sm"
          />
        </div>
        {visibleRows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium">No submissions are visible</p>
            <p className="mt-1 text-sm text-muted-foreground">Submission workflow rows will appear once admin has records to inspect.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="font-medium">{submission.assignmentTitle}</TableCell>
                    <TableCell className="text-muted-foreground">{submission.studentLabel}</TableCell>
                    <TableCell className="text-muted-foreground">{submission.fileName}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`capitalize ${toStatusBadgeClass(submission.status, SUBMISSION_STATUS_BADGE_STYLES)}`}
                      >
                        {humanizeToken(submission.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{safeFormatDate(submission.submittedAt, "MMM d, yyyy HH:mm", "Not available")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {visibleRows.length > 0 ? (
          <PaginationControls page={page} totalPages={totalPages} itemLabel="Submissions" onPageChange={setPage} />
        ) : null}
      </CardContent>
    </Card>
  );
};

const AuditLogSection = ({
  auditRows,
}: {
  auditRows: AdminAuditRow[];
}) => (
  <Card className="border-border/70 shadow-sm">
    <CardHeader className="border-b border-border/60 pb-4">
      <CardTitle className="text-base">Recent audit log</CardTitle>
      <CardDescription>Traceable protected actions and workflow events visible to admin.</CardDescription>
    </CardHeader>
    <CardContent className="p-0">
      {auditRows.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm font-medium">No audit events are visible</p>
          <p className="mt-1 text-sm text-muted-foreground">Protected actions will appear once backend audit rows are readable to the current admin session.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditRows.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-muted-foreground">{safeFormatDate(entry.createdAt, "MMM d, yyyy HH:mm", "Not available")}</TableCell>
                  <TableCell className="font-medium">{entry.actorName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={entry.source === "admin" ? "border-primary/30 bg-primary/10 text-primary" : "border-slate-500/30 bg-slate-500/10 text-slate-700"}
                      >
                        {entry.source === "admin" ? "Admin" : "Workflow"}
                      </Badge>
                      <span>{entry.action}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div>
                      <p>{entry.target}</p>
                      <p className="text-xs">{entry.detail}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </CardContent>
  </Card>
);

const RecentActivitySection = ({
  activityFeed,
}: {
  activityFeed: ActivityItem[];
}) => (
  <Card className="border-border/70 shadow-sm">
    <CardHeader className="border-b border-border/60 pb-4">
      <CardTitle className="text-base">Recent activity</CardTitle>
      <CardDescription>High-signal platform events for quick operational awareness.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3 p-6">
      {activityFeed.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <p className="text-sm font-medium">No recent activity is visible</p>
          <p className="mt-1 text-sm text-muted-foreground">This feed will populate from assignments, submissions, moderation, and audit events.</p>
        </div>
      ) : (
        activityFeed.map((item) => (
          <div key={item.id} className="flex gap-3 rounded-xl border border-border/70 p-4">
            <div className="mt-0.5">
              {item.tone === "warning" ? (
                <ShieldAlert className="h-4 w-4 text-amber-600" />
              ) : item.tone === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Activity className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.detail}</p>
              <p className="text-xs text-muted-foreground">{safeFormatDate(item.createdAt, "MMM d, yyyy HH:mm", "Not available")}</p>
            </div>
          </div>
        ))
      )}
    </CardContent>
  </Card>
);

const OverviewPage = ({
  metrics,
  healthItems,
  users,
  assignments,
  moderationRows,
  auditRows,
  activityFeed,
  onRequestRoleChange,
  changingUserId,
  onViewUser,
}: {
  metrics: AdminMetrics;
  healthItems: AdminHealthItem[];
  users: AdminUserRow[];
  assignments: AdminAssignmentRow[];
  moderationRows: AdminModerationRow[];
  auditRows: AdminAuditRow[];
  activityFeed: ActivityItem[];
  onRequestRoleChange: (user: AdminUserRow, nextRole: "student" | "lecturer") => void;
  changingUserId: string | null;
  onViewUser: (user: AdminUserRow) => void;
}) => (
  <div className="space-y-6">
    <OverviewCards metrics={metrics} />
    <SystemHealthSection items={healthItems} />
    <UserManagementSection users={users} onRequestRoleChange={onRequestRoleChange} changingUserId={changingUserId} onViewUser={onViewUser} compact />
    <AssignmentOversightSection assignments={assignments} compact />
    <IntegrityModerationSection moderationRows={moderationRows} compact />
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <AuditLogSection auditRows={auditRows} />
      <RecentActivitySection activityFeed={activityFeed} />
    </div>
  </div>
);

const AdminDashboard = () => {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<AdminMetrics>(EMPTY_METRICS);
  const [healthItems, setHealthItems] = useState<AdminHealthItem[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [assignments, setAssignments] = useState<AdminAssignmentRow[]>([]);
  const [submissions, setSubmissions] = useState<AdminSubmissionRow[]>([]);
  const [moderationRows, setModerationRows] = useState<AdminModerationRow[]>([]);
  const [auditRows, setAuditRows] = useState<AdminAuditRow[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange>(null);
  const [changingUserId, setChangingUserId] = useState<string | null>(null);
  const [selectedUserPreview, setSelectedUserPreview] = useState<SelectedUserPreview>(null);

  const activeView = useMemo<AdminView>(() => {
    const view = searchParams.get("view");
    return view === "users" || view === "system" || view === "assignments" || view === "submissions" || view === "audit"
      ? view
      : "overview";
  }, [searchParams]);

  const activeUserFilter = useMemo(() => {
    const filter = searchParams.get("filter");
    return filter === "lecturer" || filter === "student" ? filter : null;
  }, [searchParams]);

  const loadAdminDashboard = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [
        metricsRes,
        assignmentOversightRes,
        moderationOverviewRes,
        recentActivityRes,
        profilesRes,
        assignmentsRes,
        submissionsRes,
        moderationCasesRes,
      ] = await Promise.all([
        supabase.rpc("get_admin_dashboard_metrics"),
        supabase.rpc("get_admin_assignment_oversight"),
        supabase.rpc("get_admin_moderation_overview"),
        supabase.rpc("get_admin_recent_activity"),
        supabase.from("profiles").select("id, full_name, email, role, created_at").order("created_at", { ascending: false }),
        supabase.from("assignments").select("id, title, module_code, status, due_date, created_at, lecturer_id").order("created_at", { ascending: false }),
        supabase.from("submissions").select("id, assignment_id, student_name, student_email, status, submitted_at, file_name").order("submitted_at", { ascending: false }),
        supabase
          .from("moderation_cases")
          .select("id, assignment_id, first_marker_id, moderator_id, status, integrity_risk_score, confidence_score, created_at, updated_at, trigger_summary, first_marker_score, moderator_score")
          .order("updated_at", { ascending: false }),
      ]);

      if (profilesRes.error || assignmentsRes.error || submissionsRes.error || moderationCasesRes.error) {
        throw profilesRes.error || assignmentsRes.error || submissionsRes.error || moderationCasesRes.error;
      }

      const profileRows = (profilesRes.data || []).map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        role: String(row.role),
        createdAt: row.created_at ?? null,
      }));

      const lecturerNameById = new Map(
        profileRows.map((row) => [row.id, row.fullName || row.email || "Unknown lecturer"]),
      );

      const rawSubmissions = (submissionsRes.data || []).map((row) => ({
        id: row.id,
        assignmentId: row.assignment_id,
        studentLabel: row.student_name || row.student_email || "Student record unavailable",
        status: String(row.status),
        submittedAt: row.submitted_at,
        fileName: row.file_name,
      }));

      const submissionSummaryByAssignmentId = buildAssignmentSubmissionSummaryMap(rawSubmissions);
      const rpcAssignmentRows = assignmentOversightRes.error
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

      const clientAssignmentRows = (assignmentsRes.data || []).map((row) => {
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

      const rpcModerationRows = moderationOverviewRes.error
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

      const clientModerationRows = (moderationCasesRes.data || []).map((row) => ({
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
      try {
        const auditResult = await supabase
          .from("admin_audit_log")
          .select("id, created_at, target_user_name, target_user_email, details")
          .eq("action_type", "role_changed")
          .order("created_at", { ascending: false })
          .limit(25);

        if (auditResult.error) {
          throw auditResult.error;
        }

        adminAuditRows = (auditResult.data || []).map((row) => {
          const details = (row.details ?? {}) as {
            actor_name?: string;
            previous_role?: string;
            updated_role?: string;
          };

          return {
            id: `admin-${row.id}`,
            createdAt: row.created_at,
            actorName: details.actor_name || "Admin",
            action: "Changed user role",
            target: row.target_user_name || "Unknown user",
            detail: `${details.previous_role || "unknown"} -> ${details.updated_role || "unknown"}${row.target_user_email ? ` | ${row.target_user_email}` : ""}`,
            source: "admin" as const,
          };
        });
      } catch (error) {
        log.warn("Admin audit log is unavailable", {
          view: "audit",
        });
      }

      let workflowAuditRows: AdminAuditRow[] = [];
      let latestGradeRun: string | null = null;
      let aiGradingFailures: number | null = null;
      let emailNotificationsVisible = false;
      let emailNotificationsCount = 0;

      try {
        const gradeAuditRes = await supabase
          .from("grade_audit_log")
          .select("id, created_at, event_type, submission_id, reason")
          .order("created_at", { ascending: false })
          .limit(25);

        if (gradeAuditRes.error) {
          throw gradeAuditRes.error;
        }

        workflowAuditRows = (gradeAuditRes.data || []).map((row) => ({
          id: `workflow-${row.id}`,
          createdAt: row.created_at,
          actorName: "Workflow",
          action: humanizeToken(String(row.event_type)),
          target: `Submission ${row.submission_id}`,
          detail: row.reason || "Workflow event recorded",
          source: "workflow" as const,
        }));

        const todayKey = new Date().toISOString().slice(0, 10);
        aiGradingFailures = (gradeAuditRes.data || []).filter((row) => {
          const eventType = String(row.event_type).toLowerCase();
          return row.created_at.startsWith(todayKey) && (eventType.includes("fail") || eventType.includes("error"));
        }).length;
      } catch (error) {
        log.warn("Grade workflow audit is unavailable to admin", {
          view: "system",
        });
      }

      try {
        const gradesRes = await supabase.from("grades").select("id, created_at").order("created_at", { ascending: false }).limit(1);
        if (gradesRes.error) {
          throw gradesRes.error;
        }

        latestGradeRun = gradesRes.data?.[0]?.created_at ?? null;
      } catch (error) {
        log.warn("Grades are unavailable to admin dashboard", {
          view: "system",
        });
      }

      try {
        const notificationsRes = await supabase
          .from("communication_messages")
          .select("id, created_at, category, subject")
          .order("created_at", { ascending: false })
          .limit(10);

        if (notificationsRes.error) {
          throw notificationsRes.error;
        }

        emailNotificationsVisible = true;
        emailNotificationsCount = (notificationsRes.data || []).length;
      } catch (error) {
        log.warn("Communication notifications are unavailable to admin dashboard", {
          view: "system",
        });
      }

      const mergedAuditRows = [...adminAuditRows, ...workflowAuditRows]
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        .slice(0, 25);
      const rpcActivityFeed = recentActivityRes.error
        ? null
        : (recentActivityRes.data || []).map((row) => ({
            id: row.id,
            createdAt: row.created_at,
            title: row.title,
            detail: row.detail,
            tone:
              row.tone === "warning" || row.tone === "success"
                ? row.tone
                : ("neutral" as const),
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

      const healthSnapshot: AdminHealthItem[] = [
        {
          label: "AI grading service",
          statusLabel: latestGradeRun ? "Observed activity" : "No direct signal",
          tone: latestGradeRun ? "healthy" : "placeholder",
          detail: latestGradeRun
            ? `Latest grading evidence visible to admin was recorded ${safeFormatDate(latestGradeRun, "MMM d, yyyy HH:mm", "recently")}. This is an observed grading timestamp, not a live service heartbeat.`
            : "Admin can see platform workflow, but direct grading-run telemetry is not yet exposed here.",
        },
        {
          label: "Integrity checker",
          statusLabel: moderationCaseRows.length > 0 ? "Observed cases" : "No recent cases",
          tone: moderationCaseRows.length > 0 ? "healthy" : "placeholder",
          detail:
            moderationCaseRows.length > 0
              ? `${highIntegrityRiskCases} elevated integrity case(s) are currently visible to admin. This reflects observed case data, not a provider heartbeat.`
              : "No integrity or moderation case is currently visible in this snapshot, so provider health cannot be inferred from this page.",
        },
        {
          label: "Supabase connection",
          statusLabel: "Read snapshot succeeded",
          tone: "healthy",
          detail: "Profiles, assignments, submissions, and moderation tables loaded for this page refresh. This confirms dashboard reads, not full database health.",
        },
        {
          label: "Email notifications",
          statusLabel: emailNotificationsVisible ? "Records visible" : "No direct signal",
          tone: emailNotificationsVisible ? "healthy" : "placeholder",
          detail: emailNotificationsVisible
            ? `${emailNotificationsCount} recent notification record(s) are visible from the communication log. This confirms records exist, not that delivery is enabled.`
            : "Notification enablement and delivery health are not yet directly observable from the admin dashboard.",
        },
        {
          label: "Last successful grading run",
          statusLabel: latestGradeRun ? safeFormatDate(latestGradeRun, "MMM d, HH:mm", "Recorded") : "Not exposed",
          tone: latestGradeRun ? "healthy" : "placeholder",
          detail: latestGradeRun
            ? "Latest grade creation timestamp is being used as an inferred grading activity signal."
            : "A dedicated grading-run telemetry record would make this signal more reliable.",
        },
        {
          label: "Failed grading attempts today",
          statusLabel: aiGradingFailures == null ? "Pending" : String(aiGradingFailures),
          tone: aiGradingFailures == null ? "placeholder" : aiGradingFailures > 0 ? "warning" : "healthy",
          detail:
            aiGradingFailures == null
              ? "Failure counts remain placeholder until grading error events are exposed consistently to admins."
              : aiGradingFailures > 0
                ? "At least one workflow audit event suggests a grading failure today."
                : "No grading failures were detected in the visible workflow audit entries today.",
        },
      ];

      setUsers(profileRows);
      setAssignments(assignmentRows);
      setSubmissions(submissionRows);
      setModerationRows(moderationCaseRows);
      setAuditRows(mergedAuditRows);
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
      setHealthItems(healthSnapshot);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profile?.role !== "admin") {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-10 text-center">
          <p className="text-sm font-medium">Admin access required</p>
          <p className="mt-1 text-sm text-muted-foreground">This dashboard is only available to admin users.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardHeader refreshing={refreshing} onRefresh={() => void loadAdminDashboard({ silent: true })} />

      {activeView === "users" ? (
        <UserManagementSection users={visibleUsers} onRequestRoleChange={requestRoleChange} changingUserId={changingUserId} onViewUser={setSelectedUserPreview} />
      ) : activeView === "assignments" ? (
        <AssignmentOversightSection assignments={assignments} />
      ) : activeView === "submissions" ? (
        <SubmissionOversightSection submissions={submissions} />
      ) : activeView === "audit" ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <AuditLogSection auditRows={auditRows} />
          <RecentActivitySection activityFeed={activityFeed} />
        </div>
      ) : activeView === "system" ? (
        <div className="space-y-6">
          <SystemHealthSection items={healthItems} />
          <IntegrityModerationSection moderationRows={moderationRows} />
          <RecentActivitySection activityFeed={activityFeed} />
        </div>
      ) : (
        <OverviewPage
          metrics={metrics}
          healthItems={healthItems}
          users={users}
          assignments={assignments}
          moderationRows={moderationRows}
          auditRows={auditRows}
          activityFeed={activityFeed}
          onRequestRoleChange={requestRoleChange}
          changingUserId={changingUserId}
          onViewUser={setSelectedUserPreview}
        />
      )}

      <AlertDialog open={Boolean(pendingRoleChange)} onOpenChange={(open) => !open && setPendingRoleChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm role change</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRoleChange ? (
                <>
                  Change <strong>{pendingRoleChange.fullName || "this user"}</strong> from{" "}
                  <strong>{pendingRoleChange.currentRole}</strong> to <strong>{pendingRoleChange.nextRole}</strong>? This updates
                  the profile role and backend mapping together and should remain auditable.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(changingUserId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(changingUserId || refreshing)}
              onClick={(event) => {
                event.preventDefault();
                void confirmRoleChange();
              }}
            >
              {changingUserId ? "Updating..." : "Confirm Change"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(selectedUserPreview)} onOpenChange={(open) => !open && setSelectedUserPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User summary</DialogTitle>
            <DialogDescription>
              Admin-safe profile summary. Detailed student activity remains on lecturer-scoped pages and should be exposed through a dedicated admin detail view later.
            </DialogDescription>
          </DialogHeader>
          {selectedUserPreview ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</p>
                  <p className="mt-2 text-sm font-medium">{selectedUserPreview.fullName || "Unknown user"}</p>
                </div>
                <div className="rounded-xl border border-border/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
                  <p className="mt-2 text-sm font-medium">{selectedUserPreview.email || "Not available"}</p>
                </div>
                <div className="rounded-xl border border-border/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</p>
                  <div className="mt-2">
                    <Badge
                      variant="outline"
                      className={`capitalize ${toStatusBadgeClass(selectedUserPreview.role, ROLE_BADGE_STYLES)}`}
                    >
                      {selectedUserPreview.role}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Joined</p>
                  <p className="mt-2 text-sm font-medium">
                    {safeFormatDate(selectedUserPreview.createdAt, "MMM d, yyyy", "Not available")}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                Role changes should remain confirmed and logged. Cross-platform user activity, account disabling, and reset workflows are not wired into this admin screen yet.
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUserPreview(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
