import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { safeFormatDate } from "@/lib/date";
import { Loader2, Settings, Shield, Users } from "lucide-react";
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
  departmentId: string | null;
  cohortId: string | null;
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

type PendingProfileEdit = {
  userId: string;
  role: string;
  fullName: string;
  departmentId: string;
  cohortId: string;
} | null;

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

const AdminOverview = ({ metrics }: { metrics: AdminMetrics }) => (
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
      {[
        { title: "Total Users", value: metrics.totalUsers, icon: Users, helper: "All visible user accounts across the workspace." },
        { title: "Lecturers", value: metrics.lecturers, icon: Shield, helper: "Academic staff accounts currently available." },
        { title: "Students", value: metrics.students, icon: Users, helper: "Learner accounts with profile records in place." },
        { title: "Assignments", value: metrics.assignments, icon: Settings, helper: "Published and draft assignment records combined." },
        { title: "Submissions", value: metrics.submissions, icon: Shield, helper: "Student submission rows currently stored." },
        { title: "Moderation Cases", value: metrics.moderationCases, icon: Shield, helper: "Cases that entered the moderation workflow." },
      ].map((item) => (
        <Card key={item.title} className="border-border/70 shadow-sm">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.title}</p>
              <p className="text-3xl font-bold font-display tracking-tight">{item.value}</p>
              <p className="max-w-[18rem] text-xs leading-5 text-muted-foreground">{item.helper}</p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

const UserManagement = ({
  users,
  onRequestProfileEdit,
  onRequestRoleChange,
  changingUserId,
  savingProfileUserId,
}: {
  users: AdminUserRow[];
  onRequestProfileEdit: (user: AdminUserRow) => void;
  onRequestRoleChange: (user: AdminUserRow, nextRole: "student" | "lecturer") => void;
  changingUserId: string | null;
  savingProfileUserId: string | null;
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
            Review account coverage, role distribution, and profile data for student and lecturer records.
            Profile edits and role changes are kept as separate actions so admin corrections stay explicit.
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
                  <TableHead>Department</TableHead>
                  <TableHead>Cohort</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Profile</TableHead>
                  <TableHead className="text-right">Role Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.fullName || "Unknown user"}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{user.departmentId || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.role === "student" ? user.cohortId || "—" : "—"}
                    </TableCell>
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
                      {user.role === "student" || user.role === "lecturer" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingProfileUserId === user.id}
                          onClick={() => onRequestProfileEdit(user)}
                        >
                          Edit Profile
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No profile edit</span>
                      )}
                    </TableCell>
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
  const [pendingProfileEdit, setPendingProfileEdit] = useState<PendingProfileEdit>(null);
  const [savingProfileUserId, setSavingProfileUserId] = useState<string | null>(null);

  const activeView = useMemo<AdminView>(() => {
    const view = searchParams.get("view");
    return view === "users" || view === "system" ? view : "overview";
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
          .select("id, full_name, email, role, created_at, department_id, cohort_id")
          .order("created_at", { ascending: false }),
        supabase.from("assignments").select("id", { count: "exact", head: true }),
        supabase.from("submissions").select("id", { count: "exact", head: true }),
        supabase.from("moderation_cases").select("id", { count: "exact", head: true }),
      ]);

      if (profilesRes.error || assignmentsRes.error || submissionsRes.error || moderationCasesRes.error) {
        throw profilesRes.error || assignmentsRes.error || submissionsRes.error || moderationCasesRes.error;
      }

      const profileRows = ((profilesRes.data || []) as Array<{
        id: string;
        full_name: string | null;
        email: string | null;
        department_id?: string | null;
        cohort_id?: string | null;
        role: string;
        created_at: string | null;
      }>).map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        departmentId: row.department_id ?? null,
        cohortId: row.cohort_id ?? null,
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

  const requestProfileEdit = (user: AdminUserRow) => {
    setPendingProfileEdit({
      userId: user.id,
      role: user.role,
      fullName: user.fullName || "",
      departmentId: user.departmentId || "",
      cohortId: user.cohortId || "",
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

  const saveProfileEdit = async () => {
    if (!pendingProfileEdit) return;

    setSavingProfileUserId(pendingProfileEdit.userId);
    try {
      const { error } = await supabase.rpc("admin_update_user_profile", {
        p_target_user_id: pendingProfileEdit.userId,
        p_full_name: pendingProfileEdit.fullName,
        p_department_id: pendingProfileEdit.departmentId || null,
        p_cohort_id: pendingProfileEdit.cohortId || null,
      });

      if (error) throw error;

      toast.success(`${pendingProfileEdit.fullName || "User"} profile updated.`);
      setPendingProfileEdit(null);
      await loadAdminDashboard({ silent: true });
    } catch (error) {
      console.error("Failed to update user profile:", error);
      toast.error(error instanceof Error ? error.message : "Profile update could not be completed.");
    }
    setSavingProfileUserId(null);
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
          users={users}
          onRequestProfileEdit={requestProfileEdit}
          onRequestRoleChange={requestRoleChange}
          changingUserId={changingUserId}
          savingProfileUserId={savingProfileUserId}
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
      <Dialog open={Boolean(pendingProfileEdit)} onOpenChange={(open) => !open && setPendingProfileEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Update profile fields for this {pendingProfileEdit?.role || "user"}. This only affects
              the profile record and does not change role, email, password, or auth metadata.
            </DialogDescription>
          </DialogHeader>
          {pendingProfileEdit ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-profile-full-name">Full name</Label>
                <Input
                  id="admin-profile-full-name"
                  value={pendingProfileEdit.fullName}
                  onChange={(event) =>
                    setPendingProfileEdit((current) =>
                      current ? { ...current, fullName: event.target.value } : current
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-profile-department">Department</Label>
                <Input
                  id="admin-profile-department"
                  value={pendingProfileEdit.departmentId}
                  onChange={(event) =>
                    setPendingProfileEdit((current) =>
                      current ? { ...current, departmentId: event.target.value } : current
                    )
                  }
                  placeholder="Department"
                />
              </div>
              {pendingProfileEdit.role === "student" ? (
                <div className="space-y-2">
                  <Label htmlFor="admin-profile-cohort">Cohort</Label>
                  <Input
                    id="admin-profile-cohort"
                    value={pendingProfileEdit.cohortId}
                    onChange={(event) =>
                      setPendingProfileEdit((current) =>
                        current ? { ...current, cohortId: event.target.value } : current
                      )
                    }
                    placeholder="Cohort or level"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={Boolean(savingProfileUserId)}
              onClick={() => setPendingProfileEdit(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={Boolean(savingProfileUserId || refreshing)}
              onClick={() => void saveProfileEdit()}
            >
              {savingProfileUserId ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
