import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Loader2,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Button } from "@/components/ui/button";

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

const EMPTY_STATS: Stats = {
  totalSubmissions: 0,
  gradedCount: 0,
  pendingCount: 0,
  avgScore: null,
  activeStudents: 0,
  assignmentCount: 0,
  onTarget: 0,
  atRisk: 0,
};

const DEMO_STATS: Stats = {
  totalSubmissions: 42,
  gradedCount: 35,
  pendingCount: 7,
  avgScore: 64.3,
  activeStudents: 28,
  assignmentCount: 5,
  onTarget: 22,
  atRisk: 6,
};

const DEMO_RECENT: RecentSubmission[] = [
  {
    id: "d1",
    student_name: "Alice Johnson",
    file_name: "trees.py",
    status: "released",
    submitted_at: new Date(Date.now() - 86400000).toISOString(),
    assignment_title: "Data Structures",
    score: 78,
    max_score: 100,
  },
  {
    id: "d2",
    student_name: "Bob Smith",
    file_name: "essay.pdf",
    status: "ai_graded",
    submitted_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    assignment_title: "Algorithms",
    score: 55,
    max_score: 100,
  },
  {
    id: "d3",
    student_name: "Carol White",
    file_name: "report.docx",
    status: "submitted",
    submitted_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    assignment_title: "Database Design",
    score: null,
    max_score: 100,
  },
];

const DEMO_DIST = [
  { label: "90–100%", count: 4, fill: "hsl(152, 56%, 45%)" },
  { label: "70–89%", count: 12, fill: "hsl(230, 65%, 52%)" },
  { label: "50–69%", count: 14, fill: "hsl(38, 92%, 60%)" },
  { label: "< 50%", count: 5, fill: "hsl(0, 72%, 55%)" },
];

const distributionInterpretation = (dist: { label: string; count: number }[]) => {
  const top = [...dist].sort((a, b) => b.count - a.count)[0];
  if (!top || top.count === 0) return "Grade distribution will appear once submissions have been graded.";
  return `Most graded submissions currently fall in the ${top.label} band.`;
};

const formatStatusLabel = (status: string) =>
  status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const LecturerOverview = () => {
  const { profile, user, isDemo } = useAuth();
  const [stats, setStats] = useState<Stats>(isDemo ? DEMO_STATS : EMPTY_STATS);
  const [recent, setRecent] = useState<RecentSubmission[]>(isDemo ? DEMO_RECENT : []);
  const [gradeDistribution, setGradeDistribution] = useState(
    isDemo
      ? DEMO_DIST
      : [
          { label: "90–100%", count: 0, fill: "hsl(152, 56%, 45%)" },
          { label: "70–89%", count: 0, fill: "hsl(230, 65%, 52%)" },
          { label: "50–69%", count: 0, fill: "hsl(38, 92%, 60%)" },
          { label: "< 50%", count: 0, fill: "hsl(0, 72%, 55%)" },
        ]
  );
  const [loading, setLoading] = useState(!isDemo);

  const fetchDashboard = async () => {
    if (!user) return;

    try {
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("assignments")
        .select("*")
        .eq("lecturer_id", user.id);

      if (assignmentsError) throw assignmentsError;

      const assignments = assignmentsData || [];
      const assignmentIds = assignments.map((a) => a.id);

      if (assignmentIds.length === 0) {
        setStats({
          ...EMPTY_STATS,
          assignmentCount: 0,
        });
        setRecent([]);
        setGradeDistribution([
          { label: "90-100%", count: 0, color: "bg-success", fill: "hsl(152, 56%, 45%)" },
          { label: "70-89%", count: 0, color: "bg-primary", fill: "hsl(230, 65%, 52%)" },
          { label: "50-69%", count: 0, color: "bg-warning", fill: "hsl(38, 92%, 60%)" },
          { label: "< 50%", count: 0, color: "bg-destructive", fill: "hsl(0, 72%, 55%)" },
        ]);
        setLoading(false);
        return;
      }

      const { data: submissionsData, error: submissionsError } = await supabase
        .from("submissions")
        .select("*")
        .in("assignment_id", assignmentIds);

      if (submissionsError) throw submissionsError;

      const assignments = assignRes.data || [];
      const allSubs = (subRes.data || []).sort(
        (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      );
      const allGrades = gradeRes.data || [];

      const assignmentMap: Record<string, { title: string; max_score: number }> = {};
      assignments.forEach((a) => {
        assignmentMap[a.id] = { title: a.title, max_score: a.max_score };
      });

      const gradeMap: Record<string, any> = {};
      allGrades.forEach((g) => {
        gradeMap[g.submission_id] = g;
      });

      const gradedSubs = allSubs.filter((s) =>
        ["ai_graded", "under_review", "approved", "released"].includes(s.status)
      );
      const pendingSubs = allSubs.filter((s) => ["submitted", "ai_grading"].includes(s.status));
      const scores = allGrades
        .filter((g) => g.final_score != null || g.ai_score != null)
        .map((g) => g.final_score ?? g.ai_score) as number[];
      const avgScore =
        scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : null;

      const studentScores: Record<string, number[]> = {};
      allSubs.forEach((s) => {
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

      const uniqueStudents = new Set(
        allSubs.map((s) => s.student_id || s.student_name || s.student_email).filter(Boolean)
      );

      setStats({
        totalSubmissions: allSubs.length,
        gradedCount: gradedSubs.length,
        pendingCount: pendingSubs.length,
        avgScore,
        activeStudents: uniqueStudents.size,
        assignmentCount: assignments.length,
        onTarget,
        atRisk,
      });

      const dist = [
        { label: "90–100%", count: 0, fill: "hsl(152, 56%, 45%)" },
        { label: "70–89%", count: 0, fill: "hsl(230, 65%, 52%)" },
        { label: "50–69%", count: 0, fill: "hsl(38, 92%, 60%)" },
        { label: "< 50%", count: 0, fill: "hsl(0, 72%, 55%)" },
      ];
      scores.forEach((s) => {
        if (s >= 90) dist[0].count++;
        else if (s >= 70) dist[1].count++;
        else if (s >= 50) dist[2].count++;
        else dist[3].count++;
      });
      setGradeDistribution(dist);

      const recentSubs: RecentSubmission[] = allSubs.slice(0, 6).map((s) => {
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
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isDemo) return;
    void fetchDashboard();
  }, [isDemo]);

  const totalScored = gradeDistribution.reduce((a, b) => a + b.count, 0);
  const heroSummary = useMemo(() => {
    if (stats.pendingCount > 0 && stats.atRisk > 0) {
      return `${stats.pendingCount} submissions are awaiting review and ${stats.atRisk} student${stats.atRisk > 1 ? "s" : ""} may need attention.`;
    }
    if (stats.pendingCount > 0) {
      return `${stats.pendingCount} submissions are awaiting review.`;
    }
    if (stats.atRisk > 0) {
      return `${stats.atRisk} student${stats.atRisk > 1 ? "s" : ""} may need additional support.`;
    }
    return "All submissions are up to date and no immediate interventions are currently flagged.";
  }, [stats.pendingCount, stats.atRisk]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-sm">
        <CardContent className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold font-display">
                Welcome back, {profile?.full_name?.split(" ")[0] || "Lecturer"}
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">{heroSummary}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline" className="border-primary/20 bg-background/70 text-xs">
                  {stats.assignmentCount} active assignment{stats.assignmentCount === 1 ? "" : "s"}
                </Badge>
                <Badge variant="outline" className="border-primary/20 bg-background/70 text-xs">
                  {stats.activeStudents} active student{stats.activeStudents === 1 ? "" : "s"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button size="sm" className="shadow-sm">
              Review submissions
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline">
              View risk insights
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: Users,
            value: stats.activeStudents,
            label: "Active Students",
            hint: "Students with submission activity",
            accent: "border-primary/20",
            iconWrap: "bg-primary/10 text-primary",
          },
          {
            icon: Clock,
            value: stats.pendingCount,
            label: "Awaiting Review",
            hint: "Needs lecturer attention",
            accent: stats.pendingCount > 0 ? "border-warning/30" : "border-border",
            iconWrap: stats.pendingCount > 0 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground",
          },
          {
            icon: BarChart3,
            value: stats.avgScore != null ? `${stats.avgScore}%` : "—",
            label: "Average Grade",
            hint: "Across graded submissions",
            accent: "border-border",
            iconWrap: "bg-muted text-muted-foreground",
          },
          {
            icon: AlertTriangle,
            value: stats.atRisk,
            label: "At-Risk Students",
            hint: "Students who may need support",
            accent: stats.atRisk > 0 ? "border-destructive/30" : "border-border",
            iconWrap: stats.atRisk > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
          },
        ].map((item, i) => (
          <Card key={i} className={`border ${item.accent} shadow-sm`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-3xl font-bold font-display">{item.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.iconWrap}`}>
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: FileText,
            value: stats.totalSubmissions,
            label: "Total Submissions",
            iconColor: "text-primary",
          },
          {
            icon: CheckCircle,
            value: stats.gradedCount,
            label: "Graded Submissions",
            iconColor: "text-success",
          },
          {
            icon: Target,
            value: stats.onTarget,
            label: "Students On Target",
            iconColor: "text-success",
          },
        ].map((item, i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/70">
                <item.icon className={`h-5 w-5 ${item.iconColor}`} />
              </div>
              <div>
                <p className="text-xl font-bold font-display">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Submissions</CardTitle>
            <CardDescription>Latest student work that has entered your assessment workflow</CardDescription>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm font-medium">No submissions yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Submissions will appear here once students begin uploading work to your assignments.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recent.map((sub) => {
                  const needsAttention = sub.score == null || ["submitted", "ai_grading", "ai_graded"].includes(sub.status);
                  return (
                    <div
                      key={sub.id}
                      className="flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/30 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium truncate">{sub.student_name}</p>
                          {needsAttention && (
                            <Badge variant="outline" className="border-warning/30 text-warning text-[10px] uppercase tracking-wide">
                              Needs attention
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{sub.assignment_title}</p>
                        <p className="text-xs text-muted-foreground truncate">{sub.file_name}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        <Badge variant="outline" className="text-xs">
                          {formatStatusLabel(sub.status)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(sub.submitted_at).toLocaleDateString()}
                        </span>
                        {sub.score != null ? (
                          <Badge variant={sub.score >= 70 ? "default" : sub.score >= 50 ? "secondary" : "destructive"}>
                            {sub.score}/{sub.max_score}
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <Clock className="mr-1 h-3 w-3" /> Pending
                          </Badge>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs">
                          Review
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Grade Distribution</CardTitle>
              <CardDescription>{totalScored} graded submission{totalScored === 1 ? "" : "s"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {totalScored === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="text-sm font-medium">No grades yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Distribution insights will appear after submissions have been graded.
                  </p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={gradeDistribution}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {gradeDistribution.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                    {distributionInterpretation(gradeDistribution)}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Attention Needed</CardTitle>
              <CardDescription>Use these signals to prioritise your next actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-warning/10 p-2 text-warning">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{stats.pendingCount} submission{stats.pendingCount === 1 ? "" : "s"} awaiting review</p>
                    <p className="text-xs text-muted-foreground">
                      Prioritise pending work to keep feedback turnaround fast and consistent.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-destructive/10 p-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{stats.atRisk} student{stats.atRisk === 1 ? "" : "s"} may need support</p>
                    <p className="text-xs text-muted-foreground">
                      Review patterns early so interventions can happen before performance drops further.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button size="sm" className="flex-1">
                  Review queue
                </Button>
                <Button size="sm" variant="outline" className="flex-1">
                  View analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium">Export grade data</p>
            <p className="text-xs text-muted-foreground">
              Download your current overview data for reporting or review.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const rows = [["Student", "Assignment", "Score", "Max Score", "Status", "Submitted"]];
                recent.forEach((s) =>
                  rows.push([
                    s.student_name || "Unknown",
                    s.assignment_title,
                    String(s.score ?? ""),
                    String(s.max_score),
                    s.status,
                    new Date(s.submitted_at).toLocaleDateString(),
                  ])
                );
                const csv = rows.map((r) => r.join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "grades_export.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const { default: jsPDF } = await import("jspdf");
                await import("jspdf-autotable");
                const doc = new jsPDF();
                doc.setFontSize(16);
                doc.text("GradeAI — Grade Report", 14, 20);
                doc.setFontSize(10);
                doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);
                doc.text(`Lecturer: ${profile?.full_name || "—"}`, 14, 34);
                doc.text(
                  `Total Submissions: ${stats.totalSubmissions} | Graded: ${stats.gradedCount} | Avg: ${stats.avgScore ?? "—"}%`,
                  14,
                  40
                );
                (doc as any).autoTable({
                  startY: 48,
                  head: [["Student", "Assignment", "Score", "Max", "Status", "Date"]],
                  body: recent.map((s) => [
                    s.student_name || "Unknown",
                    s.assignment_title,
                    s.score != null ? String(s.score) : "—",
                    String(s.max_score),
                    formatStatusLabel(s.status),
                    new Date(s.submitted_at).toLocaleDateString(),
                  ]),
                  styles: { fontSize: 9 },
                  headStyles: { fillColor: [59, 65, 122] },
                });
                doc.save("grades_report.pdf");
              }}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LecturerOverview;
