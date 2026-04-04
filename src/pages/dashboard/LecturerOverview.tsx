import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  CheckCircle,
  Clock,
  FileText,
  TrendingDown,
  TrendingUp,
  Users,
  AlertTriangle,
  Target,
  Sparkles,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Stats {
  totalSubmissions: number;
  gradedCount: number;
  pendingCount: number;
  avgScore: number | null;
  activeStudents: number;
  assignmentCount: number;
  onTarget: number;
  atRisk: number;
}

interface RecentSubmission {
  id: string;
  student_name: string | null;
  file_name: string;
  status: string;
  submitted_at: string;
  assignment_title: string;
  score: number | null;
  max_score: number;
}

const LecturerOverview = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalSubmissions: 0, gradedCount: 0, pendingCount: 0,
    avgScore: null, activeStudents: 0, assignmentCount: 0,
    onTarget: 0, atRisk: 0,
  });
  const [recent, setRecent] = useState<RecentSubmission[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState<{ label: string; count: number; color: string; fill: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      const { data: assignments } = await supabase.from("assignments").select("id, title, max_score");
      const assignmentMap: Record<string, { title: string; max_score: number }> = {};
      (assignments || []).forEach((a: any) => { assignmentMap[a.id] = { title: a.title, max_score: a.max_score }; });

      const { data: submissions } = await supabase.from("submissions").select("*").order("submitted_at", { ascending: false });
      const allSubs = submissions || [];

      const subIds = allSubs.map((s: any) => s.id);
      let allGrades: any[] = [];
      if (subIds.length > 0) {
        const { data: gData } = await supabase.from("grades").select("*").in("submission_id", subIds);
        allGrades = gData || [];
      }
      const gradeMap: Record<string, any> = {};
      allGrades.forEach((g: any) => { gradeMap[g.submission_id] = g; });

      const gradedSubs = allSubs.filter((s: any) => ["ai_graded", "under_review", "approved", "released"].includes(s.status));
      const pendingSubs = allSubs.filter((s: any) => ["submitted", "ai_grading"].includes(s.status));
      const scores = allGrades.filter((g: any) => g.final_score != null || g.ai_score != null).map((g: any) => g.final_score ?? g.ai_score);
      const avgScore = scores.length > 0 ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10 : null;

      // Calculate on-target vs at-risk per student
      const studentScores: Record<string, number[]> = {};
      allSubs.forEach((s: any) => {
        const key = s.student_id || s.student_name || s.student_email;
        if (!key) return;
        const g = gradeMap[s.id];
        const score = g?.final_score ?? g?.ai_score;
        if (score != null) {
          if (!studentScores[key]) studentScores[key] = [];
          studentScores[key].push(score);
        }
      });
      let onTarget = 0;
      let atRisk = 0;
      Object.values(studentScores).forEach((ss) => {
        const avg = ss.reduce((a, b) => a + b, 0) / ss.length;
        if (avg >= 50) onTarget++;
        else atRisk++;
      });

      const uniqueStudents = new Set(allSubs.map((s: any) => s.student_id || s.student_name || s.student_email).filter(Boolean));

      setStats({
        totalSubmissions: allSubs.length,
        gradedCount: gradedSubs.length,
        pendingCount: pendingSubs.length,
        avgScore,
        activeStudents: uniqueStudents.size,
        assignmentCount: (assignments || []).length,
        onTarget,
        atRisk,
      });

      const dist = [
        { label: "90-100%", count: 0, color: "bg-success", fill: "hsl(152, 56%, 45%)" },
        { label: "70-89%", count: 0, color: "bg-primary", fill: "hsl(230, 65%, 52%)" },
        { label: "50-69%", count: 0, color: "bg-warning", fill: "hsl(38, 92%, 60%)" },
        { label: "< 50%", count: 0, color: "bg-destructive", fill: "hsl(0, 72%, 55%)" },
      ];
      scores.forEach((s: number) => {
        if (s >= 90) dist[0].count++;
        else if (s >= 70) dist[1].count++;
        else if (s >= 50) dist[2].count++;
        else dist[3].count++;
      });
      setGradeDistribution(dist);

      const recentSubs: RecentSubmission[] = allSubs.slice(0, 6).map((s: any) => {
        const a = assignmentMap[s.assignment_id];
        const g = gradeMap[s.id];
        return {
          id: s.id,
          student_name: s.student_name || s.student_email || "Student",
          file_name: s.file_name,
          status: s.status,
          submitted_at: s.submitted_at,
          assignment_title: a?.title || "Unknown",
          score: g?.final_score ?? g?.ai_score ?? null,
          max_score: a?.max_score || 100,
        };
      });
      setRecent(recentSubs);
      setLoading(false);
    };

    fetchDashboard();

    // Real-time listeners
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => fetchDashboard())
      .on("postgres_changes", { event: "*", schema: "public", table: "grades" }, () => fetchDashboard())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Loading dashboard...</p></div>;

  const totalScored = gradeDistribution.reduce((a, b) => a + b.count, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display">
              Welcome back, {profile?.full_name?.split(" ")[0] || "Lecturer"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {stats.pendingCount > 0
                ? `You have ${stats.pendingCount} submissions awaiting review.`
                : "All submissions are up to date."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Color-coded KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display">{stats.activeStudents}</p>
                <p className="text-xs text-muted-foreground">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[hsl(var(--success))]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                <Target className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display text-success">{stats.onTarget}</p>
                <p className="text-xs text-muted-foreground">On Target</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display text-destructive">{stats.atRisk}</p>
                <p className="text-xs text-muted-foreground">At-Risk Students</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[hsl(var(--warning))]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
                <BarChart3 className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display">{stats.avgScore != null ? `${stats.avgScore}%` : "—"}</p>
                <p className="text-xs text-muted-foreground">Avg Performance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary stats */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xl font-bold font-display">{stats.totalSubmissions}</p>
              <p className="text-xs text-muted-foreground">Total Submissions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle className="h-5 w-5 text-success" />
            <div>
              <p className="text-xl font-bold font-display">{stats.gradedCount}</p>
              <p className="text-xs text-muted-foreground">Graded</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 text-warning" />
            <div>
              <p className="text-xl font-bold font-display">{stats.pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Submissions */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Recent Submissions</CardTitle>
            <CardDescription>Latest student submissions across assignments</CardDescription>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No submissions yet</p>
            ) : (
              <div className="space-y-3">
                {recent.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{sub.student_name}</p>
                      <p className="text-xs text-muted-foreground">{sub.assignment_title}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {new Date(sub.submitted_at).toLocaleDateString()}
                      </span>
                      {sub.score != null ? (
                        <Badge variant={sub.score >= 70 ? "default" : sub.score >= 50 ? "secondary" : "destructive"}>
                          {sub.score}/{sub.max_score}
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Clock className="mr-1 h-3 w-3" />Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grade Distribution Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Grade Distribution</CardTitle>
            <CardDescription>{totalScored} graded submissions</CardDescription>
          </CardHeader>
          <CardContent>
            {totalScored === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No grades yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={gradeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {gradeDistribution.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {stats.pendingCount > 5 && (
        <Card className="border-warning">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <p className="text-sm">
              <span className="font-medium">{stats.pendingCount} submissions</span> are awaiting grading. Consider using AI grading to speed up the process.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LecturerOverview;
