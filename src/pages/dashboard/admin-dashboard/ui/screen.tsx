import { Suspense, lazy, type Dispatch, type SetStateAction } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookCopy,
  CheckCircle2,
  FileOutput,
  GraduationCap,
  Loader2,
  RefreshCw,
  Scale,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { safeFormatDate } from "@/lib/date";
import type { OperationalFailureCard } from "@/lib/operationalMonitoring";

import type {
  ActivityItem,
  AdminAuditRow,
  AdminDashboardState,
  AdminMetrics,
  AdminOverviewCard,
  AdminUserRow,
  PendingRoleChange,
  SelectedUserPreview,
} from "../types";
import { AssignmentOversightSection } from "./assignment-oversight-section";
import { IntegrityModerationSection } from "./integrity-moderation-section";
import { SubmissionOversightSection } from "./submission-oversight-section";
import { SystemHealthSection } from "./system-health-section";
import { UserManagementSection } from "./user-management-section";
import { formatCount, maybeWrapNavigationCard, toStatusBadgeClass, ROLE_BADGE_STYLES } from "./shared";

const BulkStudentUpload = lazy(() =>
  import("@/components/BulkStudentUpload").then((module) => ({
    default: module.BulkStudentUpload,
  })),
);

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
        <Suspense
          fallback={
            <Button variant="outline" disabled>
              Bulk Student Upload
            </Button>
          }
        >
          <BulkStudentUpload />
        </Suspense>
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
    { title: "Total Users", value: String(metrics.totalUsers), helper: "Platform-wide visible accounts.", href: "/dashboard?view=users", icon: Users },
    { title: "Active Lecturers", value: String(metrics.activeLecturers), helper: "Academic staff accounts currently active.", href: "/dashboard?view=users&filter=lecturer", icon: GraduationCap },
    { title: "Active Students", value: String(metrics.activeStudents), helper: "Student profiles visible to admin.", href: "/dashboard?view=users&filter=student", icon: Users },
    { title: "Assignments", value: String(metrics.totalAssignments), helper: "Draft and published assignment records.", href: "/dashboard?view=assignments", icon: BookCopy },
    { title: "Submissions", value: String(metrics.totalSubmissions), helper: "All submission rows across the platform.", href: "/dashboard?view=submissions", icon: FileOutput },
    { title: "Pending Moderation", value: String(metrics.pendingModerationCases), helper: "Cases still awaiting academic resolution.", href: "/dashboard?view=system", icon: Scale },
    { title: "AI Grading Failures", value: formatCount(metrics.aiGradingFailures), helper: "Marked as placeholder until failure events are fully exposed to admins.", href: "/dashboard?view=system", icon: AlertTriangle },
    { title: "High Integrity Risk", value: String(metrics.highIntegrityRiskCases), helper: "Cases with elevated integrity risk or escalation signals.", href: "/dashboard?view=system", icon: ShieldAlert },
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

        return <div key={item.title}>{maybeWrapNavigationCard({ href: item.href, onNavigate: navigate, label: `View ${item.title}`, content: card })}</div>;
      })}
    </div>
  );
};

const OperationalFailureSection = ({
  cards,
}: {
  cards: OperationalFailureCard[];
}) => (
  <Card className="border-border/70 shadow-sm">
    <CardHeader className="border-b border-border/60 pb-4">
      <CardTitle className="text-base">Failure dashboard</CardTitle>
      <CardDescription>Observed bottlenecks and failure-oriented workflow signals that deserve operational triage.</CardDescription>
    </CardHeader>
    <CardContent className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.title} className="rounded-xl border border-border/70 bg-background/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{card.title}</p>
            <Badge
              variant="outline"
              className={
                card.tone === "healthy"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                  : card.tone === "warning"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                    : "border-slate-500/30 bg-slate-500/10 text-slate-700"
              }
            >
              {card.value}
            </Badge>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{card.detail}</p>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.action}</p>
        </div>
      ))}
    </CardContent>
  </Card>
);

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
                      <Badge variant="outline" className={entry.source === "admin" ? "border-primary/30 bg-primary/10 text-primary" : "border-slate-500/30 bg-slate-500/10 text-slate-700"}>
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
  failureCards,
  users,
  assignments,
  submissions,
  moderationRows,
  auditRows,
  activityFeed,
  onRequestRoleChange,
  changingUserId,
  onSyncRoleMetadata,
  syncingUserId,
  onViewUser,
}: {
  metrics: AdminMetrics;
  healthItems: AdminDashboardState["healthItems"];
  failureCards: OperationalFailureCard[];
  users: AdminUserRow[];
  assignments: AdminDashboardState["assignments"];
  submissions: AdminDashboardState["submissions"];
  moderationRows: AdminDashboardState["moderationRows"];
  auditRows: AdminAuditRow[];
  activityFeed: ActivityItem[];
  onRequestRoleChange: (user: AdminUserRow, nextRole: "student" | "lecturer") => void;
  changingUserId: string | null;
  onSyncRoleMetadata: (user: AdminUserRow) => void;
  syncingUserId: string | null;
  onViewUser: (user: AdminUserRow) => void;
}) => (
  <div className="space-y-6">
    <OverviewCards metrics={metrics} />
    <OperationalFailureSection cards={failureCards} />
    <SystemHealthSection items={healthItems} />
    <UserManagementSection
      users={users}
      onRequestRoleChange={onRequestRoleChange}
      changingUserId={changingUserId}
      onSyncRoleMetadata={onSyncRoleMetadata}
      syncingUserId={syncingUserId}
      onViewUser={onViewUser}
      compact
    />
    <AssignmentOversightSection assignments={assignments} compact />
    <SubmissionOversightSection submissions={submissions} compact />
    <IntegrityModerationSection moderationRows={moderationRows} compact />
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <AuditLogSection auditRows={auditRows} />
      <RecentActivitySection activityFeed={activityFeed} />
    </div>
  </div>
);

type AdminDashboardActions = {
  loadAdminDashboard: (options?: { silent?: boolean }) => Promise<void>;
  requestRoleChange: (user: AdminUserRow, nextRole: "student" | "lecturer") => void;
  confirmRoleChange: () => Promise<void>;
  syncUserRoleMetadata: (targetUser: AdminUserRow) => Promise<void>;
  setPendingRoleChange: Dispatch<SetStateAction<PendingRoleChange>>;
  setSelectedUserPreview: Dispatch<SetStateAction<SelectedUserPreview>>;
};

export const AdminDashboardScreen = ({
  state,
  actions,
}: {
  state: AdminDashboardState;
  actions: AdminDashboardActions;
}) => {
  const {
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
    activeView,
    visibleUsers,
    pendingRoleChange,
    changingUserId,
    syncingUserId,
    selectedUserPreview,
  } = state;
  const { loadAdminDashboard, requestRoleChange, confirmRoleChange, syncUserRoleMetadata, setPendingRoleChange, setSelectedUserPreview } = actions;

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardHeader refreshing={refreshing} onRefresh={() => void loadAdminDashboard({ silent: true })} />

      {activeView === "users" ? (
        <UserManagementSection
          users={visibleUsers}
          onRequestRoleChange={requestRoleChange}
          changingUserId={changingUserId}
          onSyncRoleMetadata={syncUserRoleMetadata}
          syncingUserId={syncingUserId}
          onViewUser={setSelectedUserPreview}
        />
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
          <OperationalFailureSection cards={failureCards} />
          <SystemHealthSection items={healthItems} />
          <IntegrityModerationSection moderationRows={moderationRows} />
          <RecentActivitySection activityFeed={activityFeed} />
        </div>
      ) : (
        <OverviewPage
          metrics={metrics}
          healthItems={healthItems}
          failureCards={failureCards}
          users={users}
          assignments={assignments}
          submissions={submissions}
          moderationRows={moderationRows}
          auditRows={auditRows}
          activityFeed={activityFeed}
          onRequestRoleChange={requestRoleChange}
          changingUserId={changingUserId}
          onSyncRoleMetadata={syncUserRoleMetadata}
          syncingUserId={syncingUserId}
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
                    <Badge variant="outline" className={`capitalize ${toStatusBadgeClass(selectedUserPreview.role, ROLE_BADGE_STYLES)}`}>
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
