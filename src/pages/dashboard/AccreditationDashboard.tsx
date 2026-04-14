import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Award, CheckCircle, AlertTriangle, XCircle, Clock, FileText,
  Download, BarChart3, Shield, Users, Loader2, BookOpen,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const ASSIGNMENT_FIELDS = "id, title, module_code, due_date, description, rubric";
const SUBMISSION_FIELDS = "id, assignment_id, submitted_at, status";
const GRADE_FIELDS = "submission_id, ai_score, final_score, ai_feedback, lecturer_score, reviewed_by, created_at";
const PROFILE_FIELDS = "id, role";

interface QAAMetric {
  id: string;
  category: string;
  metric: string;
  value: number;
  target: number;
  status: "met" | "at-risk" | "below";
  detail: string;
}

interface NSSMetric {
  question: string;
  score: number;
  benchmark: number;
  trend: string;
}

interface TEFIndicator {
  name: string;
  rating: "gold" | "silver" | "bronze" | "pending";
  score: number;
  detail: string;
}

const tefRating = (score: number): "gold" | "silver" | "bronze" | "pending" =>
  score >= 80 ? "gold" : score >= 65 ? "silver" : score >= 50 ? "bronze" : "pending";

const AccreditationDashboard = () => {
  const { isDemo } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!isDemo);
  const [qaaMetrics, setQaaMetrics] = useState<QAAMetric[]>([]);
  const [nssMetrics, setNssMetrics] = useState<NSSMetric[]>([]);
  const [tefIndicators, setTefIndicators] = useState<TEFIndicator[]>([]);
  const [feedbackTurnaround, setFeedbackTurnaround] = useState({ avg: 0, target: 15, compliant: 0, total: 0 });

  useEffect(() => {
    if (isDemo) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [{ data: gradesRaw }, { data: subsRaw }, { data: assignmentsRaw }, { data: profilesRaw }] = await Promise.all([
          supabase.from("grades").select(GRADE_FIELDS),
          supabase.from("submissions").select(SUBMISSION_FIELDS),
          supabase.from("assignments").select(ASSIGNMENT_FIELDS),
          supabase.from("profiles").select(PROFILE_FIELDS),
        ]);

        const grades = gradesRaw || [];
        const subs = subsRaw || [];
        const assignments = assignmentsRaw || [];
        const profiles = profilesRaw || [];

        const scores = grades
          .map(d => d.final_score ?? d.ai_score)
          .filter((s): s is number => s != null);

        const studentCount = profiles.filter(d => d.role === "student").length;
        const passRate = scores.length > 0 ? Math.round((scores.filter(s => s >= 40).length / scores.length) * 100) : 0;
        const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        const completionRate = subs.length > 0 && assignments.length > 0 && studentCount > 0
          ? Math.min(Math.round((subs.length / (assignments.length * studentCount)) * 100), 100)
          : 0;
        const gradedPct = Math.min(Math.round((grades.length / Math.max(subs.length, 1)) * 100), 100);

        // Feedback turnaround
        let turnaroundDays: number[] = [];
        const gradeMap: Record<string, any> = {};
        grades.forEach(d => { gradeMap[d.submission_id] = d; });
        subs.forEach(d => {
          const grade = gradeMap[d.id];
          if (grade?.created_at && d.submitted_at) {
            const diff = (new Date(grade.created_at).getTime() - new Date(d.submitted_at).getTime()) / (1000 * 60 * 60 * 24);
            if (diff >= 0) turnaroundDays.push(diff);
          }
        });
        const avgTurnaround = turnaroundDays.length > 0 ? Math.round(turnaroundDays.reduce((a, b) => a + b, 0) / turnaroundDays.length) : 0;
        const compliantCount = turnaroundDays.filter(d => d <= 15).length;
        setFeedbackTurnaround({ avg: avgTurnaround, target: 15, compliant: compliantCount, total: turnaroundDays.length });

        const withRubric = assignments.filter(d => {
          const r = d.rubric;
          return r && Array.isArray(r) && (r as any[]).length > 0;
        }).length;
        const rubricPct = assignments.length > 0 ? Math.round((withRubric / assignments.length) * 100) : 0;

        const moderated = grades.filter(d => d.reviewed_by || d.lecturer_score != null).length;
        const moderationPct = grades.length > 0 ? Math.round((moderated / grades.length) * 100) : 0;

        const released = subs.filter(d => d.status === "released").length;
        const releasedPct = subs.length > 0 ? Math.round((released / subs.length) * 100) : 0;

        const metrics: QAAMetric[] = [
          {
            id: "criteria-transparency", category: "Assessment Design",
            metric: "Assessment Criteria Transparency", value: rubricPct, target: 100,
            status: rubricPct >= 90 ? "met" : rubricPct >= 70 ? "at-risk" : "below",
            detail: `${withRubric}/${assignments.length} assignments have published rubrics`,
          },
          {
            id: "feedback-turnaround", category: "Feedback Quality",
            metric: "Feedback Turnaround (≤15 days)", value: turnaroundDays.length > 0 ? Math.round((compliantCount / turnaroundDays.length) * 100) : 0, target: 90,
            status: compliantCount >= turnaroundDays.length * 0.9 ? "met" : compliantCount >= turnaroundDays.length * 0.7 ? "at-risk" : "below",
            detail: `${compliantCount}/${turnaroundDays.length} submissions graded within 15 days (avg: ${avgTurnaround} days)`,
          },
          {
            id: "moderation", category: "Quality Assurance",
            metric: "Moderation Evidence", value: moderationPct, target: 100,
            status: moderationPct >= 90 ? "met" : moderationPct >= 70 ? "at-risk" : "below",
            detail: `${moderated}/${grades.length} grades have lecturer review/moderation`,
          },
          {
            id: "pass-rate", category: "Student Outcomes",
            metric: "Module Pass Rate", value: passRate, target: 75,
            status: passRate >= 75 ? "met" : passRate >= 65 ? "at-risk" : "below",
            detail: `${scores.filter(s => s >= 40).length}/${scores.length} students passed (≥40%)`,
          },
          {
            id: "completion", category: "Student Engagement",
            metric: "Assessment Completion Rate", value: completionRate, target: 85,
            status: completionRate >= 85 ? "met" : completionRate >= 70 ? "at-risk" : "below",
            detail: `${subs.length} submissions across ${assignments.length} assignments`,
          },
          {
            id: "grade-release", category: "Feedback Quality",
            metric: "Grade Release Rate", value: releasedPct, target: 95,
            status: releasedPct >= 95 ? "met" : releasedPct >= 80 ? "at-risk" : "below",
            detail: `${released}/${subs.length} grades released to students`,
          },
          {
            id: "graded", category: "Quality Assurance",
            metric: "Graded Submissions", value: gradedPct, target: 95,
            status: gradedPct >= 95 ? "met" : gradedPct >= 80 ? "at-risk" : "below",
            detail: `${grades.length}/${subs.length} submissions graded`,
          },
          {
            id: "avg-score", category: "Student Outcomes",
            metric: "Average Assessment Score", value: avgScore, target: 55,
            status: avgScore >= 55 ? "met" : avgScore >= 45 ? "at-risk" : "below",
            detail: `Mean score across all graded submissions`,
          },
        ];

        setQaaMetrics(metrics);

        // Derive NSS-style metrics from real data
        const rubricClarityScore = rubricPct;
        const feedbackTimelinessScore = turnaroundDays.length > 0 ? Math.min(Math.round((compliantCount / turnaroundDays.length) * 100), 100) : 0;
        const feedbackHelpfulness = grades.filter(g => g.ai_feedback && g.ai_feedback.length > 100).length;
        const feedbackHelpPct = grades.length > 0 ? Math.min(Math.round((feedbackHelpfulness / grades.length) * 100), 100) : 0;
        const organisationScore = assignments.filter(a => a.due_date && a.description).length;
        const orgPct = assignments.length > 0 ? Math.min(Math.round((organisationScore / assignments.length) * 100), 100) : 0;
        const overallSat = scores.length > 0 ? Math.min(Math.round(avgScore * 1.1), 100) : 0;

        setNssMetrics([
          { question: "Assessment criteria are clear in advance", score: rubricClarityScore, benchmark: 78, trend: rubricClarityScore >= 78 ? `+${rubricClarityScore - 78}%` : `${rubricClarityScore - 78}%` },
          { question: "Feedback has been timely", score: feedbackTimelinessScore, benchmark: 72, trend: feedbackTimelinessScore >= 72 ? `+${feedbackTimelinessScore - 72}%` : `${feedbackTimelinessScore - 72}%` },
          { question: "Feedback has helped clarify things", score: feedbackHelpPct, benchmark: 75, trend: feedbackHelpPct >= 75 ? `+${feedbackHelpPct - 75}%` : `${feedbackHelpPct - 75}%` },
          { question: "The course is well organised", score: orgPct, benchmark: 77, trend: orgPct >= 77 ? `+${orgPct - 77}%` : `${orgPct - 77}%` },
          { question: "Assessment is fair", score: passRate, benchmark: 80, trend: passRate >= 80 ? `+${passRate - 80}%` : `${passRate - 80}%` },
          { question: "Overall satisfaction with quality", score: overallSat, benchmark: 80, trend: overallSat >= 80 ? `+${overallSat - 80}%` : `${overallSat - 80}%` },
        ]);

        // Derive TEF indicators from real data
        const teachingScore = Math.min(Math.round((rubricClarityScore * 0.4 + feedbackHelpPct * 0.3 + orgPct * 0.3)), 100);
        const outcomeScore = Math.min(Math.round((passRate * 0.5 + avgScore * 0.5)), 100);
        const feedbackScore = Math.min(Math.round((feedbackTimelinessScore * 0.5 + feedbackHelpPct * 0.3 + moderationPct * 0.2)), 100);
        const engagementScore = Math.min(Math.round((completionRate * 0.6 + gradedPct * 0.4)), 100);

        setTefIndicators([
          { name: "Teaching Quality", rating: tefRating(teachingScore), score: teachingScore, detail: `Based on rubric clarity (${rubricClarityScore}%), feedback quality, and organisation` },
          { name: "Student Outcomes", rating: tefRating(outcomeScore), score: outcomeScore, detail: `Pass rate: ${passRate}%, average score: ${avgScore}%` },
          { name: "Assessment & Feedback", rating: tefRating(feedbackScore), score: feedbackScore, detail: `Turnaround compliance: ${feedbackTimelinessScore}%, moderation: ${moderationPct}%` },
          { name: "Student Engagement", rating: tefRating(engagementScore), score: engagementScore, detail: `Completion rate: ${completionRate}%, grading rate: ${gradedPct}%` },
        ]);
      } catch (err) {
        console.error("Failed to fetch accreditation data:", err);
      }
      setLoading(false);
    };

    fetchData();
  }, [isDemo]);

  const statusIcon = (s: string) => {
    if (s === "met") return <CheckCircle className="h-4 w-4 text-success" />;
    if (s === "at-risk") return <AlertTriangle className="h-4 w-4 text-warning" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const tefColor = (r: string) => {
    if (r === "gold") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    if (r === "silver") return "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300";
    if (r === "bronze") return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    return "bg-muted text-muted-foreground";
  };

  const overallCompliance = qaaMetrics.length > 0
    ? Math.round(qaaMetrics.filter(m => m.status === "met").length / qaaMetrics.length * 100) : 0;
  const metCount = qaaMetrics.filter(m => m.status === "met").length;
  const atRiskCount = qaaMetrics.filter(m => m.status === "at-risk").length;
  const belowCount = qaaMetrics.filter(m => m.status === "below").length;
  const nssAverage = nssMetrics.length > 0
    ? Math.round(nssMetrics.reduce((sum, m) => sum + m.score, 0) / nssMetrics.length)
    : 0;
  const nssBenchmarkAverage = nssMetrics.length > 0
    ? Math.round(nssMetrics.reduce((sum, m) => sum + m.benchmark, 0) / nssMetrics.length)
    : 0;
  const weakestQaaMetric = [...qaaMetrics].sort((left, right) => left.value - right.value)[0];
  const weakestTefIndicator = [...tefIndicators].sort((left, right) => left.score - right.score)[0];

  const exportQAAReport = () => {
    const lines = ["QAA Compliance Report — GradeAI", `Generated: ${new Date().toISOString().slice(0, 10)}`, ""];
    lines.push("Metric,Value,Target,Status,Detail");
    qaaMetrics.forEach(m => lines.push(`"${m.metric}",${m.value}%,${m.target}%,${m.status},"${m.detail}"`));
    lines.push("", `Overall Compliance: ${overallCompliance}%`);
    lines.push(`Met: ${metCount}, At Risk: ${atRiskCount}, Below: ${belowCount}`);

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `qaa_compliance_report_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="flex items-center gap-2 p-3">
            <Badge variant="outline" className="border-warning text-warning">Demo</Badge>
            <span className="text-sm text-muted-foreground">Viewing demo accreditation data</span>
          </CardContent>
        </Card>
      )}

      {!isDemo && qaaMetrics.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Accreditation metrics will auto-populate once you create assignments, upload submissions, and complete grading.
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overall Compliance</p>
                <p className="text-2xl font-bold font-display">{overallCompliance}%</p>
              </div>
              <Award className="h-8 w-8 text-primary" />
            </div>
            <Progress value={overallCompliance} className="mt-3 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Standards Met</p>
                <p className="text-2xl font-bold font-display text-success">{metCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">At Risk</p>
                <p className="text-2xl font-bold font-display text-warning">{atRiskCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Below Target</p>
                <p className="text-2xl font-bold font-display text-destructive">{belowCount}</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Findings</CardTitle>
          <CardDescription>Immediate accreditation and quality signals from current live data</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Weakest compliance area</p>
            <p className="mt-2 text-sm font-semibold">{weakestQaaMetric?.metric || "No compliance data yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {weakestQaaMetric
                ? `${weakestQaaMetric.value}% against a ${weakestQaaMetric.target}% target. This is the first metric you would be asked to explain.`
                : "Populate assignments, submissions, and grading to generate live compliance findings."}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">NSS pressure point</p>
            <p className="mt-2 text-sm font-semibold">
              {nssMetrics.length > 0
                ? nssMetrics.reduce((lowest, metric) => (metric.score < lowest.score ? metric : lowest)).question
                : "No NSS-style signal yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {nssMetrics.length > 0
                ? "Use this to prioritise process changes that students will actually feel."
                : "NSS-style indicators appear automatically once grading activity exists."}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">TEF watch area</p>
            <p className="mt-2 text-sm font-semibold">{weakestTefIndicator?.name || "No TEF indicator yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {weakestTefIndicator
                ? `${weakestTefIndicator.score}% with a ${weakestTefIndicator.rating} rating. This is the weakest evidence line in the current dataset.`
                : "TEF-style indicators become meaningful after more grading and release activity."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recommended Actions</CardTitle>
          <CardDescription>Jump from quality signals to the workflows that improve them</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <button
            type="button"
            className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40"
            onClick={() => navigate("/dashboard/assignments?view=needs-review")}
          >
            <p className="text-sm font-medium">Reduce feedback backlog</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The fastest way to improve turnaround, moderation evidence, and grade release metrics is clearing the pending queue.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open pending submissions <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
          <button
            type="button"
            className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40"
            onClick={() => navigate("/dashboard/performance?risk=high-plus")}
          >
            <p className="text-sm font-medium">Tackle student outcome risk</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Open the filtered at-risk cohort and intervene where pass rates and outcome metrics are weakest.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open at-risk cohort <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
          <button
            type="button"
            className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40"
            onClick={() => navigate("/dashboard/learning-outcomes")}
          >
            <p className="text-sm font-medium">Review weak rubric outcomes</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use learning outcomes to identify which criteria need clearer teaching, feedback, or rubric alignment.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open learning outcomes <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
        </CardContent>
      </Card>

      <Tabs defaultValue="qaa" className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="qaa">QAA Compliance</TabsTrigger>
            <TabsTrigger value="nss">NSS & Satisfaction</TabsTrigger>
            <TabsTrigger value="tef">TEF Indicators</TabsTrigger>
            <TabsTrigger value="programme">Programme Reports</TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={exportQAAReport}>
            <Download className="mr-2 h-3.5 w-3.5" /> Export Report
          </Button>
        </div>

        {/* QAA Tab */}
        <TabsContent value="qaa" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /><CardTitle className="text-base">QAA Quality Standards</CardTitle></div>
              <CardDescription>Assessment criteria transparency, feedback turnaround, and moderation evidence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {qaaMetrics.map((m) => (
                <div key={m.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {statusIcon(m.status)}
                      <span className="font-medium text-sm">{m.metric}</span>
                      <Badge variant="outline" className="text-[10px]">{m.category}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{m.value}%</span>
                      <Badge variant={m.status === "met" ? "default" : m.status === "at-risk" ? "secondary" : "destructive"} className="text-xs">
                        {m.status === "met" ? "Met" : m.status === "at-risk" ? "At Risk" : "Below"}
                      </Badge>
                    </div>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${m.status === "met" ? "bg-success" : m.status === "at-risk" ? "bg-warning" : "bg-destructive"}`}
                      style={{ width: `${m.value}%` }}
                    />
                    <div className="absolute inset-y-0 w-0.5 bg-foreground/40" style={{ left: `${m.target}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{m.detail}</span>
                    <span>Target: {m.target}%</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Feedback Turnaround Detail */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><CardTitle className="text-base">Feedback Turnaround Analysis</CardTitle></div>
              <CardDescription>QAA requirement: Students should receive feedback within 15 working days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold font-display">{feedbackTurnaround.avg}</p>
                  <p className="text-xs text-muted-foreground">Average days to feedback</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold font-display">{feedbackTurnaround.compliant}/{feedbackTurnaround.total}</p>
                  <p className="text-xs text-muted-foreground">Within 15-day target</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold font-display">
                    {feedbackTurnaround.total > 0 ? Math.round((feedbackTurnaround.compliant / feedbackTurnaround.total) * 100) : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Compliance rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NSS Tab */}
        <TabsContent value="nss" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><CardTitle className="text-base">National Student Survey (NSS)</CardTitle></div>
              <CardDescription>Student satisfaction metrics and benchmarks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {nssMetrics.map((m, i) => (
                <div key={i} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium flex-1">{m.question}</span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className={`font-bold ${m.score >= m.benchmark ? "text-success" : "text-destructive"}`}>{m.score}%</span>
                      <span className="text-muted-foreground">vs {m.benchmark}%</span>
                      <span className={m.trend.startsWith("+") ? "text-success" : "text-destructive"}>{m.trend}</span>
                    </div>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${m.score >= m.benchmark ? "bg-success" : "bg-warning"}`}
                      style={{ width: `${m.score}%` }}
                    />
                    <div className="absolute inset-y-0 w-0.5 bg-foreground/40" style={{ left: `${m.benchmark}%` }} />
                  </div>
                </div>
              ))}
              <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Overall NSS Score</p>
                <p className="text-2xl font-bold font-display text-foreground">{nssAverage}%</p>
                <p className="text-xs mt-1">Benchmark average: {nssBenchmarkAverage}%</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEF Tab */}
        <TabsContent value="tef" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" /><CardTitle className="text-base">Teaching Excellence Framework (TEF)</CardTitle></div>
              <CardDescription>TEF assessment indicators and ratings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tefIndicators.map((t, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${tefColor(t.rating)}`}>{t.rating}</span>
                      <span className="font-medium text-sm">{t.name}</span>
                    </div>
                    <span className="text-lg font-bold">{t.score}%</span>
                  </div>
                  <Progress value={t.score} className="h-2" />
                  <p className="text-xs text-muted-foreground">{t.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Programme Reports Tab */}
        <TabsContent value="programme" className="space-y-4">
          <ProgrammeReports isDemo={isDemo} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const ProgrammeReports = ({ isDemo }: { isDemo: boolean }) => {
  const [loading, setLoading] = useState(!isDemo);
  const [programmes, setProgrammes] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ data: assignmentsRaw }, { data: subsRaw }, { data: gradesRaw }] = await Promise.all([
          supabase.from("assignments").select("id, title, module_code"),
          supabase.from("submissions").select("id, assignment_id"),
          supabase.from("grades").select("submission_id, ai_score, final_score"),
        ]);

        const assignments = assignmentsRaw || [];
        const subs = subsRaw || [];
        const grades = gradesRaw || [];

        const gradeBySubmission: Record<string, number> = {};
        grades.forEach(d => {
          const score = d.final_score ?? d.ai_score;
          if (score != null) gradeBySubmission[d.submission_id] = score;
        });

        const modules: Record<string, { title: string; scores: number[]; submissions: number; total: number }> = {};
        assignments.forEach(d => {
          const key = d.module_code || "Unassigned";
          if (!modules[key]) modules[key] = { title: d.title, scores: [], submissions: 0, total: 0 };
        });

        subs.forEach(d => {
          const assignment = assignments.find(a => a.id === d.assignment_id);
          if (assignment) {
            const key = assignment.module_code || "Unassigned";
            if (modules[key]) {
              modules[key].submissions++;
              const score = gradeBySubmission[d.id];
              if (score != null) modules[key].scores.push(score);
            }
          }
        });

        const programmeData = Object.entries(modules).map(([code, data]) => {
          const avg = data.scores.length > 0 ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length) : 0;
          const passRate = data.scores.length > 0 ? Math.round((data.scores.filter(s => s >= 40).length / data.scores.length) * 100) : 0;
          const firstClass = data.scores.length > 0 ? Math.round((data.scores.filter(s => s >= 70).length / data.scores.length) * 100) : 0;
          const twoOne = data.scores.length > 0 ? Math.round((data.scores.filter(s => s >= 60 && s < 70).length / data.scores.length) * 100) : 0;
          const twoTwo = data.scores.length > 0 ? Math.round((data.scores.filter(s => s >= 50 && s < 60).length / data.scores.length) * 100) : 0;
          const third = data.scores.length > 0 ? Math.round((data.scores.filter(s => s >= 40 && s < 50).length / data.scores.length) * 100) : 0;
          const fail = data.scores.length > 0 ? Math.round((data.scores.filter(s => s < 40).length / data.scores.length) * 100) : 0;
          return { code, submissions: data.submissions, graded: data.scores.length, avg, passRate, firstClass, twoOne, twoTwo, third, fail };
        });

        setProgrammes(programmeData);
      } catch (err) { console.error(err); }
      setLoading(false);
    };

    fetchData();
  }, []);

  const exportProgrammeReport = () => {
    const lines = ["Programme-Level Report — GradeAI", `Generated: ${new Date().toISOString().slice(0, 10)}`, ""];
    lines.push("Module,Submissions,Graded,Avg Score,Pass Rate,1st,2:1,2:2,3rd,Fail");
    programmes.forEach(p => lines.push(`${p.code},${p.submissions},${p.graded},${p.avg}%,${p.passRate}%,${p.firstClass}%,${p.twoOne}%,${p.twoTwo}%,${p.third}%,${p.fail}%`));

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `programme_report_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Programme-Level Reports</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={exportProgrammeReport}>
            <Download className="mr-2 h-3.5 w-3.5" /> Export
          </Button>
        </div>
        <CardDescription>Grade distributions and pass rates per module with UK classification breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {programmes.map((p, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">{p.code}</span>
                  <p className="text-xs text-muted-foreground">{p.submissions} submissions · {p.graded} graded</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold">{p.avg}%</span>
                  <p className="text-xs text-muted-foreground">avg score</p>
                </div>
              </div>
              <div className="flex gap-1 h-6 rounded-full overflow-hidden">
                {p.firstClass > 0 && <div className="bg-success" style={{ width: `${p.firstClass}%` }} title={`1st: ${p.firstClass}%`} />}
                {p.twoOne > 0 && <div className="bg-primary" style={{ width: `${p.twoOne}%` }} title={`2:1: ${p.twoOne}%`} />}
                {p.twoTwo > 0 && <div className="bg-warning" style={{ width: `${p.twoTwo}%` }} title={`2:2: ${p.twoTwo}%`} />}
                {p.third > 0 && <div className="bg-orange-400" style={{ width: `${p.third}%` }} title={`3rd: ${p.third}%`} />}
                {p.fail > 0 && <div className="bg-destructive" style={{ width: `${p.fail}%` }} title={`Fail: ${p.fail}%`} />}
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" /> 1st: {p.firstClass}%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> 2:1: {p.twoOne}%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" /> 2:2: {p.twoTwo}%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400" /> 3rd: {p.third}%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" /> Fail: {p.fail}%</span>
                <span className="ml-auto">Pass rate: <strong>{p.passRate}%</strong></span>
              </div>
            </div>
          ))}
          {programmes.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No programme data available yet. Create assignments with module codes to generate reports.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AccreditationDashboard;
