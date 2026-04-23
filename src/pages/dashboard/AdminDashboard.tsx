import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { safeFormatDate } from "@/lib/date";
import { Loader2, Settings, Shield, Users } from "lucide-react";

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

const EMPTY_METRICS: AdminMetrics = {
  totalUsers: 0,
  lecturers: 0,
  students: 0,
  assignments: 0,
  submissions: 0,
  moderationCases: 0,
};

const AdminDashboard = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AdminMetrics>(EMPTY_METRICS);
  const [users, setUsers] = useState<AdminUserRow[]>([]);

  useEffect(() => {
    if (profile?.role !== "admin") {
      setLoading(false);
      return;
    }

    const loadAdminDashboard = async () => {
      try {
        const [
          profilesRes,
          assignmentsRes,
          submissionsRes,
          moderationCasesRes,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, email, role, created_at")
            .order("created_at", { ascending: false }),
          supabase.from("assignments").select("id", { count: "exact", head: true }),
          supabase.from("submissions").select("id", { count: "exact", head: true }),
          supabase.from("moderation_cases").select("id", { count: "exact", head: true }),
        ]);

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
      }

      setLoading(false);
    };

    void loadAdminDashboard();
  }, [profile?.role]);

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
    <div className="space-y-6 animate-fade-in">
      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-sm">
        <CardContent className="space-y-2 p-6">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Admin</Badge>
            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Control Panel</span>
          </div>
          <h2 className="text-xl font-bold font-display">Admin dashboard</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Read-only platform overview for user counts, assessment volume, and current account inventory.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { title: "Total Users", value: metrics.totalUsers, icon: Users },
          { title: "Lecturers", value: metrics.lecturers, icon: Shield },
          { title: "Students", value: metrics.students, icon: Users },
          { title: "Assignments", value: metrics.assignments, icon: Settings },
          { title: "Submissions", value: metrics.submissions, icon: Shield },
          { title: "Moderation Cases", value: metrics.moderationCases, icon: Shield },
        ].map((item) => (
          <Card key={item.title} className="shadow-sm">
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.title}</p>
                <p className="mt-2 text-3xl font-bold font-display">{item.value}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">User Management</CardTitle>
          <CardDescription>Read-only account list from the profiles table.</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm font-medium">No user records available</p>
              <p className="mt-1 text-sm text-muted-foreground">
                User rows will appear here when profile data is accessible to admin.
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.fullName || "Unknown user"}</TableCell>
                      <TableCell>{user.email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{safeFormatDate(user.createdAt, "MMM d, yyyy", "—")}</TableCell>
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

export default AdminDashboard;
