import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { safeFormatDate } from "@/lib/date";
import { ArrowRight, Loader2, Settings, Shield, Users } from "lucide-react";
import { toast } from "sonner";

type AdminMetrics = {
  totalUsers: number;
  lecturers: number;
  students: number;
  assignments: number;
  submissions: number;
  moderationCases: number;
};

type AdminUserRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  role: string;
  createdAt: string | null;
};

type AdminView = "overview" | "users" | "system";

type PendingRoleChange = {
  userId: string;
  fullName: string | null;
  currentRole: string;
  nextRole: "student" | "lecturer";
} | null;

type AdminOverviewCard = {
  title: string;
  value: number;
  icon: typeof Users;
  helper: string;
  href?: string;
};

const EMPTY_METRICS: AdminMetrics = {
  totalUsers: 0,
  lecturers: 0,
  students: 0,
  assignments: 0,
  submissions: 0,
  moderationCases: 0,
};

const ROLE_BADGE_STYLES: Record<string, string> = {
  admin: "border-primary/30 bg-primary/10 text-primary",
  lecturer: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  student: "border-sky-500/30 bg-sky-500/10 text-sky-700",
};

const AdminOverview = ({ metrics }: { metrics: AdminMetrics }) => {
  const navigate = useNavigate();
  const cards: AdminOverviewCard[] = [
    {
      title: "Total Users",
      value: metrics.totalUsers,
      icon: Users,
      helper: "All visible user accounts across the workspace.",
      href: "/dashboard?view=users",
    },
    {
      title: "Lecturers",
      value: metrics.lecturers,
      icon: Shield,
      helper: "Academic staff accounts currently available.",
      href: "/dashboard?view=users&filter=lecturer",
    },
    {
      title: "Students",
      value: metrics.students,
      icon: Users,
      helper: "Learner accounts with profile records in place.",
      href: "/dashboard?view=users&filter=student",
    },
    {
      title: "Assignments",
      value: metrics.assignments,
      icon: Settings,
      helper: "Published and draft assignment records combined.",
    },
    {
      title: "Submissions",
      value: metrics.submissions,
      icon: Shield,
      helper: "Student submission rows currently stored.",
    },
    {
      title: "Moderation Cases",
      value: metrics.moderationCases,
      icon: Shield,
      helper: "Cases that entered the moderation workflow.",
      href: "/dashboard/moderation",
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.16),hsl(var(--primary)/0.05)_45%,transparent)] shadow-sm">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/25 bg-background/70">Admin Workspace</Badge>
            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Overview</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold font-display tracking-tight">Admin Dashboard</h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Monitor platform activity, account distribution, and assessment volume from one read-only control panel.
              This view is intended for quick operational awareness rather than direct workflow management.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((item) => {
          const clickable = Boolean(item.href);

          const card = (
            <Card
              className={`border-border/70 shadow-sm transition-all ${
                clickable
                  ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-within:border-primary/40 focus-within:shadow-md"
                  : ""
              }`}
            >
              <CardContent className="flex items-start justify-between gap-4 p-5">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.title}</p>
                  <p className="text-3xl font-bold font-display tracking-tight">{item.value}</p>
                  <p className="max-w-[18rem] text-xs leading-5 text-muted-foreground">{item.helper}</p>
                  {clickable ? (
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

          if (!clickable) {
            return <div key={item.title}>{card}</div>;
          }

          return (
            <button
              key={item.title}
              type="button"
              onClick={() => navigate(item.href!)}
              className="w-full text-left"
              aria-label={`View details for ${item.title}`}
            >
              {card}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const UserManagement = ({
  users,
  onRequestRoleChange,
  changingUserId,
}: {
  users: AdminUserRow[];
  onRequestRoleChange: (user: AdminUserRow, nextRole: "student" | "lecturer") => void;
  changingUserId: string | null;
}) => (
  <div className="space-y-6">
    <Card className="border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.16),hsl(var(--primary)/0.05)_45%,transparent)] shadow-sm">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/25 bg-background/70">Admin Workspace</Badge>
          <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">User Management</span>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold font-display tracking-tight">User Management</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Review account coverage, role distribution, and creation history. Role changes are limited to the
            supported student and lecturer transitions and always require confirmation.
          </p>
        </div>
      </CardContent>
    </Card>

    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="text-base">Accounts</CardTitle>
        <CardDescription>Profile records visible from the current admin session.</CardDescription>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm font-medium">No user records are available</p>
            <p className="mt-1 text-sm text-muted-foreground">
              User records will appear here once profile data is available to the current admin account.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.fullName || "Unknown user"}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`capitalize ${ROLE_BADGE_STYLES[user.role] || "border-muted bg-muted/40 text-foreground"}`}
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{safeFormatDate(user.createdAt, "MMM d, yyyy", "—")}</TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
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

const SystemOverview = ({ metrics }: { metrics: AdminMetrics }) => (
  <div className="space-y-6">
    <Card className="border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.16),hsl(var(--primary)/0.05)_45%,transparent)] shadow-sm">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/25 bg-background/70">Admin Workspace</Badge>
          <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">System Overview</span>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold font-display tracking-tight">System Overview</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Review current platform footprint and operational readiness signals. This section is intentionally
            read-only and positions future admin controls without changing today&apos;s workflow behavior.
          </p>
        </div>
      </CardContent>
    </Card>

    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base">Current Volume</CardTitle>
          <CardDescription>Live counts visible from the current database snapshot.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{metrics.assignments} assignment records are currently in the workspace.</p>
          <p>{metrics.submissions} submission records are currently stored.</p>
          <p>{metrics.moderationCases} moderation cases are currently active or archived.</p>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base">User Footprint</CardTitle>
          <CardDescription>Read-only snapshot of account distribution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{metrics.totalUsers} total users are visible to admin.</p>
          <p>{metrics.lecturers} lecturer accounts are currently listed.</p>
          <p>{metrics.students} student accounts are currently listed.</p>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base">Planned Controls</CardTitle>
          <CardDescription>Reserved space for future administrative capabilities.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>User role changes are intentionally limited to supported staff and student transitions.</p>
          <p>System configuration controls are not exposed from the UI yet.</p>
          <p>Audit tooling and operational actions can be introduced here later without changing the current route structure.</p>
        </CardContent>
      </Card>
    </div>
  </div>
);

const AdminDashboard = () => {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<AdminMetrics>(EMPTY_METRICS);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange>(null);
  const [changingUserId, setChangingUserId] = useState<string | null>(null);

  const activeView = useMemo<AdminView>(() => {
    const view = searchParams.get("view");
    return view === "users" || view === "system" ? view : "overview";
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
      const [profilesRes, assignmentsRes, submissionsRes, moderationCasesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, role, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("assignments").select("id", { count: "exact", head: true }),
        supabase.from("submissions").select("id", { count: "exact", head: true }),
        supabase.from("moderation_cases").select("id", { count: "exact", head: true }),
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

      setUsers(profileRows);
      setMetrics({
        totalUsers: profileRows.length,
        lecturers: profileRows.filter((row) => row.role === "lecturer").length,
        students: profileRows.filter((row) => row.role === "student").length,
        assignments: assignmentsRes.count ?? 0,
        submissions: submissionsRes.count ?? 0,
        moderationCases: moderationCasesRes.count ?? 0,
      });
    } catch (error) {
      console.error("Failed to load admin dashboard:", error);
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
      const { error } = await supabase.rpc("admin_set_user_role", {
        p_target_user_id: pendingRoleChange.userId,
        p_target_role: pendingRoleChange.nextRole,
      });

      if (error) throw error;

      toast.success(
        `${pendingRoleChange.fullName || "User"} is now set to ${pendingRoleChange.nextRole}.`
      );
      setPendingRoleChange(null);
      await loadAdminDashboard({ silent: true });
    } catch (error) {
      console.error("Failed to update user role:", error);
      toast.error(error instanceof Error ? error.message : "Role change could not be completed.");
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
          <p className="mt-1 text-sm text-muted-foreground">
            This dashboard is only available to admin users.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="animate-fade-in">
      {activeView === "users" ? (
        <UserManagement
          users={visibleUsers}
          onRequestRoleChange={requestRoleChange}
          changingUserId={changingUserId}
        />
      ) : activeView === "system" ? (
        <SystemOverview metrics={metrics} />
      ) : (
        <AdminOverview metrics={metrics} />
      )}
      <AlertDialog open={Boolean(pendingRoleChange)} onOpenChange={(open) => !open && setPendingRoleChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm role change</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRoleChange ? (
                <>
                  Change <strong>{pendingRoleChange.fullName || "this user"}</strong> from{" "}
                  <strong>{pendingRoleChange.currentRole}</strong> to{" "}
                  <strong>{pendingRoleChange.nextRole}</strong>? This will update both the profile role and
                  the backend role mapping in one operation.
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
    </div>
  );
};

export default AdminDashboard;
