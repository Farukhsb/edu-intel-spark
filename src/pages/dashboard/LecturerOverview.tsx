import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, CheckCircle, Clock, Download, FileText, Users, AlertTriangle, Target, Sparkles, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Button } from "@/components/ui/button";

interface Stats {
  totalSubmissions: number; gradedCount: number; pendingCount: number;
  avgScore: number | null; activeStudents: number; assignmentCount: number;
  onTarget: number; atRisk: number;
}

interface RecentSubmission {
  id: string; student_name: string | null; file_name: string; status: string;
  submitted_at: string; assignment_title: string; score: number | null; max_score: number;
}

const EMPTY_STATS: Stats = {
  totalSubmissions: 0, gradedCount: 0, pendingCount: 0,
  avgScore: null, activeStudents: 0, assignmentCount: 0, onTarget: 0, atRisk: 0,
};

const LecturerOverview = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [recent, setRecent] = useState<RecentSubmission[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState([
    { label: "90-100%", count: 0, color: "bg-success", fill: "hsl(152, 56%, 45%)" },
    { label: "70-89%", count: 0, color: "bg-primary", fill: "hsl(230, 65%, 52%)" },
    { label: "50-69%", count: 0, color: "bg-warning", fill: "hsl(38, 92%, 60%)" },
    { label: "< 50%", count: 0, color: "bg-destructive", fill: "hsl(0, 72%, 55%)" },
  ]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      const [assignRes, subRes, gradeRes] = await Promise.all([
        supabase.from("assignments").select("*"),
        supabase.from("submissions").select("*"),
        supabase.from("grades").select("*"),
      ]);

      const assignments = assignRes.data || [];
      const allSubs = (subRes.data || []).sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
      const allGrades = gradeRes.data || [];

      const assignmentMap: Record<string, { title: string; max_score: number }> = {};
      assignments.forEach((a) => { assignmentMap[a.id] = { title: a.title, max_score: a.max_score }; });

      const gradeMap: Record<string, any> = {};
      allGrades.forEach((g) => { gradeMap[g.submission_id] = g; });

      const gradedSubs = allSubs.filter((s) => ["ai_graded", "under_review", "approved", "released"].includes(s.status));
      const pendingSubs = allSubs.filter((s) => ["submitted", "ai_grading"].includes(s.status));
      const scores = allGrades.filter((g) => g.final_score != null || g.ai_score != null).map((g) => g.final_score ?? g.ai_score) as number[];
      const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;

      const studentScores: Record<string, number[]> = {};
      allSubs.forEach((s) => {
        const key = s.student_id || s.student_name || s.student_email;
        if (!key) return;
        const g = gradeMap[s.id]; const score = g?.final_score ?? g?.ai_score;
        if (score != null) { if (!studentScores[key]) studentScores[key] = []; studentScores[key].push(score); }
      });
      let onTarget = 0, atRisk = 0;
      Object.values(studentScores).forEach((ss) => { const avg = ss.reduce((a, b) => a + b, 0) / ss.length; if (avg >= 50) onTarget++; else atRisk++; });

      const uniqueStudents = new Set(allSubs.map((s) => s.student_id || s.student_name || s.student_email).filter(Boolean));

      setStats({ totalSubmissions: allSubs.length, gradedCount: gradedSubs.length, pendingCount: pendingSubs.length, avgScore, activeStudents: uniqueStudents.size, assignmentCount: assignments.length, onTarget, atRisk });

      const dist = [
        { label: "90-100%", count: 0, color: "bg-success", fill: "hsl(152, 56%, 45%)" },
        { label: "70-89%", count: 0, color: "bg-primary", fill: "hsl(230, 65%, 52%)" },
        { label: "50-69%", count: 0, color: "bg-warning", fill: "hsl(38, 92%, 60%)" },
        { label: "< 50%", count: 0, color: "bg-destructive", fill: "hsl(0, 72%, 55%)" },
      ];
      scores.forEach((s) => { if (s >= 90) dist[0].count++; else if (s >= 70) dist[1].count++; else if (s >= 50) dist[2].count++; else dist[3].count++; });
      setGradeDistribution(dist);

      const recentSubs: RecentSubmission[] = allSubs.slice(0, 6).map((s) => {
        const a = assignmentMap[s.assignment_id]; const g = gradeMap[s.id];
        return { id: s.id, student_name: s.student_name || s.student_email || "Student", file_name: s.file_name, status: s.status, submitted_at: s.submitted_at, assignment_title: a?.title || "Unknown", score: g?.final_score ?? g?.ai_score ?? null, max_score: a?.max_score || 100 };
      });
      setRecent(recentSubs);
    } catch (err) { console.error("Dashboard fetch error:", err); }
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const totalScored = gradeDistribution.reduce((a, b) => a + b.count, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Sparkles className="h-6 w-6" /></div>
          <div>
            <h2 className="text-lg font-bold font-display">Welcome back, {profile?.full_name?.split(" ")[0] || "Lecturer"}</h2>
            <p className="text-sm text-muted-foreground">{stats.pendingCount > 0 ? `You have ${stats.pendingCount} submissions awaiting review.` : "All submissions are up to date."}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Users, value: stats.activeStudents, label: "Total Students", color: "border-l-primary", iconColor: "text-primary", bgColor: "bg-primary/10" },
          { icon: Target, value: stats.onTarget, label: "On Target", color: "border-l-[hsl(var(--success))]", iconColor: "text-success", bgColor: "bg-success/10", textColor: "text-success" },
          { icon: AlertTriangle, value: stats.atRisk, label: "At-Risk Students", color: "border-l-destructive", iconColor: "text-destructive", bgColor: "bg-destructive/10", textColor: "text-destructive" },
          { icon: BarChart3, value: stats.avgScore != null ? `${stats.avgScore}%` : "—", label: "Avg Performance", color: "border-l-[hsl(var(--warning))]", iconColor: "text-warning", bgColor: "bg-warning/10" },
        ].map((item, i) => (
          <Card key={i} className={`border-l-4 ${item.color}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.bgColor}`}><item.icon className={`h-5 w-5 ${item.iconColor}`} /></div>
                <div>
                  <p className={`text-2xl font-bold font-display ${item.textColor || ""}`}>{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 grid-cols-3">
        {[
          { icon: FileText, value: stats.totalSubmissions, label: "Total Submissions", iconColor: "text-primary" },
          { icon: CheckCircle, value: stats.gradedCount, label: "Graded", iconColor: "text-success" },
          { icon: Clock, value: stats.pendingCount, label: "Pending", iconColor: "text-warning" },
        ].map((item, i) => (
          <Card key={i}><CardContent className="flex items-center gap-3 p-4"><item.icon className={`h-5 w-5 ${item.iconColor}`} /><div><p className="text-xl font-bold font-display">{item.value}</p><p className="text-xs text-muted-foreground">{item.label}</p></div></CardContent></Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle className="text-base">Recent Submissions</CardTitle><CardDescription>Latest student submissions</CardDescription></CardHeader>
          <CardContent>
            {recent.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No submissions yet</p> : (
              <div className="space-y-3">
                {recent.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div><p className="text-sm font-medium">{sub.student_name}</p><p className="text-xs text-muted-foreground">{sub.assignment_title}</p></div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{new Date(sub.submitted_at).toLocaleDateString()}</span>
                      {sub.score != null ? <Badge variant={sub.score >= 70 ? "default" : sub.score >= 50 ? "secondary" : "destructive"}>{sub.score}/{sub.max_score}</Badge> : <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />Pending</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Grade Distribution</CardTitle><CardDescription>{totalScored} graded submissions</CardDescription></CardHeader>
          <CardContent>
            {totalScored === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No grades yet</p> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={gradeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>{gradeDistribution.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {stats.pendingCount > 5 && (
        <Card className="border-warning border-l-4">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <p className="text-sm"><span className="font-medium">{stats.pendingCount} submissions</span> are awaiting grading. Consider using AI grading.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium">Export Grades</p>
            <p className="text-xs text-muted-foreground">Download all grades as CSV or PDF</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const rows = [["Student", "Assignment", "Score", "Max Score", "Status", "Submitted"]];
              recent.forEach(s => rows.push([s.student_name || "Unknown", s.assignment_title, String(s.score ?? ""), String(s.max_score), s.status, new Date(s.submitted_at).toLocaleDateString()]));
              const csv = rows.map(r => r.join(",")).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "grades_export.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={async () => {
              const { default: jsPDF } = await import("jspdf");
              await import("jspdf-autotable");
              const doc = new jsPDF();
              doc.setFontSize(16);
              doc.text("GradeAI — Grade Report", 14, 20);
              doc.setFontSize(10);
              doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);
              doc.text(`Lecturer: ${profile?.full_name || "—"}`, 14, 34);
              doc.text(`Total Submissions: ${stats.totalSubmissions} | Graded: ${stats.gradedCount} | Avg: ${stats.avgScore ?? "—"}%`, 14, 40);
              (doc as any).autoTable({
                startY: 48,
                head: [["Student", "Assignment", "Score", "Max", "Status", "Date"]],
                body: recent.map(s => [
                  s.student_name || "Unknown",
                  s.assignment_title,
                  s.score != null ? String(s.score) : "—",
                  String(s.max_score),
                  s.status.replace(/_/g, " "),
                  new Date(s.submitted_at).toLocaleDateString(),
                ]),
                styles: { fontSize: 9 },
                headStyles: { fillColor: [59, 65, 122] },
              });
              doc.save("grades_report.pdf");
            }}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LecturerOverview;
