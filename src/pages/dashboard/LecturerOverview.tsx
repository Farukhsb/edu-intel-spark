import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  CheckCircle,
  Clock,
  FileText,
  TrendingDown,
  TrendingUp,
  Users,
  AlertTriangle,
} from "lucide-react";

interface Stats {
  totalSubmissions: number;
  gradedCount: number;
  pendingCount: number;
  avgScore: number | null;
  activeStudents: number;
  assignmentCount: number;
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
  const [stats, setStats] = useState<Stats>({
    totalSubmissions: 0, gradedCount: 0, pendingCount: 0,
    avgScore: null, activeStudents: 0, assignmentCount: 0,
  });
  const [recent, setRecent] = useState<RecentSubmission[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState<{ label: string; count: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      // Fetch assignments
      const { data: assignments } = await supabase.from("assignments").select("id, title, max_score");
      const assignmentMap: Record<string, { title: string; max_score: number }> = {};
      (assignments || []).forEach((a: any) => { assignmentMap[a.id] = { title: a.title, max_score: a.max_score }; });

      // Fetch all submissions
      const { data: submissions } = await supabase.from("submissions").select("*").order("submitted_at", { ascending: false });
      const allSubs = submissions || [];

      // Fetch grades
      const subIds = allSubs.map((s: any) => s.id);
      let allGrades: any[] = [];
      if (subIds.length > 0) {
        const { data: gData } = await supabase.from("grades").select("*").in("submission_id", subIds);
        allGrades = gData || [];
      }
      const gradeMap: Record<string, any> = {};
      allGrades.forEach((g: any) => { gradeMap[g.submission_id] = g; });

      // Compute stats
      const gradedSubs = allSubs.filter((s: any) => ["ai_graded", "under_review", "approved", "released"].includes(s.status));
      const pendingSubs = allSubs.filter((s: any) => ["submitted", "ai_grading"].includes(s.status));
      const scores = allGrades.filter((g: any) => g.final_score != null || g.ai_score != null).map((g: any) => g.final_score ?? g.ai_score);
      const avgScore = scores.length > 0 ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10 : null;

      const uniqueStudents = new Set(allSubs.map((s: any) => s.student_id || s.student_name || s.student_email).filter(Boolean));

      setStats({
        totalSubmissions: allSubs.length,
        gradedCount: gradedSubs.length,
        pendingCount: pendingSubs.length,
        avgScore,
        activeStudents: uniqueStudents.size,
        assignmentCount: (assignments || []).length,
      });

      // Grade distribution
      const dist = [
        { label: "90-100%", count: 0, color: "bg-success" },
        { label: "70-89%", count: 0, color: "bg-primary" },
        { label: "50-69%", count: 0, color: "bg-warning" },
        { label: "< 50%", count: 0, color: "bg-destructive" },
      ];

      scores.forEach((s: number) => {
        // Normalize to percentage (assume max_score context)
        const pct = s; // scores are raw, not percentage yet
        if (pct >= 90) dist[0].count++;
        else if (pct >= 70) dist[1].count++;
        else if (pct >= 50) dist[2].count++;
        else dist[3].count++;
      });
      setGradeDistribution(dist);

      // Recent submissions
      const recentSubs: RecentSubmission[] = allSubs.slice(0, 8).map((s: any) => {
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
  }, []);

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Loading dashboard...</p></div>;

  const statCards = [
    { label: "Total Submissions", value: stats.totalSubmissions.toString(), icon: FileText, color: "text-primary" },
    { label: "Graded", value: stats.gradedCount.toString(), icon: CheckCircle, color: "text-success" },
    { label: "Pending", value: stats.pendingCount.toString(), icon: Clock, color: "text-warning" },
    { label: "Avg Score", value: stats.avgScore != null ? `${stats.avgScore}` : "—", icon: BarChart3, color: "text-primary" },
    { label: "Active Students", value: stats.activeStudents.toString(), icon: Users, color: "text-secondary" },
    { label: "Assignments", value: stats.assignmentCount.toString(), icon: FileText, color: "text-accent" },
  ];

  const totalScored = gradeDistribution.reduce((a, b) => a + b.count, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold font-display">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
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

        {/* Grade Distribution */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Grade Distribution</CardTitle>
            <CardDescription>{totalScored} graded submissions</CardDescription>
          </CardHeader>
          <CardContent>
            {totalScored === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No grades yet</p>
            ) : (
              <div className="space-y-4">
                {gradeDistribution.map((d) => (
                  <div key={d.label} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{d.label}</span>
                      <span className="text-sm font-bold">{d.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${d.color}`} style={{ width: `${totalScored > 0 ? (d.count / totalScored) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* At-risk students */}
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
