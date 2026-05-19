import { Activity, ArrowRight, BookCopy, CheckCircle2, FileOutput, GraduationCap, ShieldAlert, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { safeFormatDate } from "@/lib/date";

import type {
  ActivityItem,
  AdminAuditRow,
  AdminDashboardState,
  AdminMetrics,
  AdminOverviewCard,
  AdminUserRow,
} from "../types";
import { AssignmentOversightSection } from "./assignment-oversight-section";
import { IntegrityModerationSection } from "./integrity-moderation-section";
import { OperationalFailureSection } from "./operational-sections";
import { SubmissionOversightSection } from "./submission-oversight-section";
import { SystemHealthSection } from "./system-health-section";
import { UserManagementSection } from "./user-management-section";
import { formatCount, maybeWrapNavigationCard } from "./shared";

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
    { title: "Pending Moderation", value: String(metrics.pendingModerationCases), helper: "Cases still awaiting academic resolution.", href: "/dashboard?view=system", icon: ShieldAlert },
    { title: "AI Grading Failures", value: formatCount(metrics.aiGradingFailures), helper: "Direct grading error events recorded today and visible to admin.", href: "/dashboard?view=system", icon: ShieldAlert },
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

export const AuditLogSection = ({
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

export const RecentActivitySection = ({
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

export const OverviewPage = ({
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
  onEditUser,
}: {
  metrics: AdminMetrics;
  healthItems: AdminDashboardState["healthItems"];
  failureCards: AdminDashboardState["failureCards"];
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
  onEditUser: (user: AdminUserRow) => void;
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
      onEditUser={onEditUser}
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
