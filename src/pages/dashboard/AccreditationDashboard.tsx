import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Award, CheckCircle, AlertTriangle, XCircle, Clock, FileText,
  Download, BarChart3, Shield, Users, Loader2, BookOpen,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { log } from "@/lib/logger";
import {
  deriveAccreditationMetrics,
  deriveProgrammeReports,
  type NSSMetric,
  type ProgrammeReport,
  type QAAMetric,
  type TEFIndicator,
} from "@/lib/accreditationMetrics";

const ASSIGNMENT_FIELDS = "id, title, module_code, due_date, description, rubric";
const SUBMISSION_FIELDS = "id, assignment_id, submitted_at, status";
const GRADE_FIELDS = "submission_id, ai_score, final_score, ai_feedback, lecturer_score, reviewed_by, created_at";
const PROFILE_FIELDS = "id, role";

const MetricBar = ({ value, className = "h-2" }: { value: number; className?: string }) => (
  <div className={`overflow-hidden rounded-full bg-muted ${className}`}>
    <div
      className="h-full rounded-full bg-primary transition-all"
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

const AccreditationDashboard = () => {
  const { isDemo } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("qaa");
  const [loading, setLoading] = useState(!isDemo);
  const [loadError, setLoadError] = useState(false);
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
        const [
          { data: gradesRaw, error: gradesError },
          { data: subsRaw, error: submissionsError },
          { data: assignmentsRaw, error: assignmentsError },
          { data: profilesRaw, error: profilesError },
        ] = await Promise.all([
          supabase.from("grades").select(GRADE_FIELDS),
          supabase.from("submissions").select(SUBMISSION_FIELDS),
          supabase.from("assignments").select(ASSIGNMENT_FIELDS),
          supabase.from("profiles").select(PROFILE_FIELDS),
        ]);

        if (gradesError) throw gradesError;
        if (submissionsError) throw submissionsError;
        if (assignmentsError) throw assignmentsError;
        if (profilesError) throw profilesError;

        const grades = gradesRaw || [];
        const subs = subsRaw || [];
        const assignments = assignmentsRaw || [];
        const profiles = profilesRaw || [];

        const derived = deriveAccreditationMetrics({
          grades,
          submissions: subs,
          assignments,
          profiles,
        });
        setQaaMetrics(derived.qaaMetrics);
        setNssMetrics(derived.nssMetrics);
        setTefIndicators(derived.tefIndicators);
        setFeedbackTurnaround(derived.feedbackTurnaround);
        setLoadError(false);
      } catch (err) {
        log.error("Failed to fetch accreditation data", err);
        setQaaMetrics([]);
        setNssMetrics([]);
        setTefIndicators([]);
        setLoadError(true);
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

  const summary = useMemo(() => {
    const overallCompliance =
      qaaMetrics.length > 0
        ? Math.round((qaaMetrics.filter((metric) => metric.status === "met").length / qaaMetrics.length) * 100)
        : 0;
    const metCount = qaaMetrics.filter((metric) => metric.status === "met").length;
    const atRiskCount = qaaMetrics.filter((metric) => metric.status === "at-risk").length;
    const belowCount = qaaMetrics.filter((metric) => metric.status === "below").length;
    const nssAverage =
      nssMetrics.length > 0 ? Math.round(nssMetrics.reduce((sum, metric) => sum + metric.score, 0) / nssMetrics.length) : 0;
    const nssBenchmarkAverage =
      nssMetrics.length > 0
        ? Math.round(nssMetrics.reduce((sum, metric) => sum + metric.benchmark, 0) / nssMetrics.length)
        : 0;

    return {
      overallCompliance,
      metCount,
      atRiskCount,
      belowCount,
      nssAverage,
      nssBenchmarkAverage,
      weakestQaaMetric: [...qaaMetrics].sort((left, right) => left.value - right.value)[0],
      weakestTefIndicator: [...tefIndicators].sort((left, right) => left.score - right.score)[0],
    };
  }, [nssMetrics, qaaMetrics, tefIndicators]);

  const exportQAAReport = () => {
    const lines = ["QAA Compliance Report — GradeAI", `Generated: ${new Date().toISOString().slice(0, 10)}`, ""];
    lines.push("Metric,Value,Target,Status,Detail");
    qaaMetrics.forEach(m => lines.push(`"${m.metric}",${m.value}%,${m.target}%,${m.status},"${m.detail}"`));
    lines.push("", `Overall Compliance: ${summary.overallCompliance}%`);
    lines.push(`Met: ${summary.metCount}, At Risk: ${summary.atRiskCount}, Below: ${summary.belowCount}`);

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `qaa_compliance_report_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  try {
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
            {loadError
              ? "Accreditation metrics could not be loaded right now. Try again later."
              : "Accreditation metrics will auto-populate once you create assignments, upload submissions, and complete grading."}
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
                <p className="text-2xl font-bold font-display">{summary.overallCompliance}%</p>
              </div>
              <Award className="h-8 w-8 text-primary" />
            </div>
            <div className="mt-3">
              <MetricBar value={summary.overallCompliance} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Standards Met</p>
                <p className="text-2xl font-bold font-display text-success">{summary.metCount}</p>
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
                <p className="text-2xl font-bold font-display text-warning">{summary.atRiskCount}</p>
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
                <p className="text-2xl font-bold font-display text-destructive">{summary.belowCount}</p>
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
            <p className="mt-2 text-sm font-semibold">{summary.weakestQaaMetric?.metric || "No compliance data yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.weakestQaaMetric
                ? `${summary.weakestQaaMetric.value}% against a ${summary.weakestQaaMetric.target}% target. This is the first metric you would be asked to explain.`
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
            <p className="mt-2 text-sm font-semibold">{summary.weakestTefIndicator?.name || "No TEF indicator yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.weakestTefIndicator
                ? `${summary.weakestTefIndicator.score}% with a ${summary.weakestTefIndicator.rating} rating. This is the weakest evidence line in the current dataset.`
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
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
                <p className="text-2xl font-bold font-display text-foreground">{summary.nssAverage}%</p>
                <p className="text-xs mt-1">Benchmark average: {summary.nssBenchmarkAverage}%</p>
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
                  <MetricBar value={t.score} />
                  <p className="text-xs text-muted-foreground">{t.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Programme Reports Tab */}
        <TabsContent value="programme" className="space-y-4">
          {activeTab === "programme" ? <ProgrammeReports isDemo={isDemo} /> : null}
        </TabsContent>
      </Tabs>
    </div>
    );
  } catch (error) {
    log.error("Accreditation dashboard render failed", error);
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Accreditation metrics could not be rendered from the current dataset. Reload the page after new assessment data is available.
        </CardContent>
      </Card>
    );
  }
};

const ProgrammeReports = ({ isDemo }: { isDemo: boolean }) => {
  const [loading, setLoading] = useState(!isDemo);
  const [programmes, setProgrammes] = useState<ProgrammeReport[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          { data: assignmentsRaw, error: assignmentsError },
          { data: subsRaw, error: submissionsError },
          { data: gradesRaw, error: gradesError },
        ] = await Promise.all([
          supabase.from("assignments").select("id, title, module_code"),
          supabase.from("submissions").select("id, assignment_id"),
          supabase.from("grades").select("submission_id, ai_score, final_score"),
        ]);

        if (assignmentsError) throw assignmentsError;
        if (submissionsError) throw submissionsError;
        if (gradesError) throw gradesError;

        setProgrammes(
          deriveProgrammeReports({
            assignments: assignmentsRaw || [],
            submissions: subsRaw || [],
            grades: gradesRaw || [],
          })
        );
      } catch (err) {
        log.error("Failed to load programme report data", err);
        setProgrammes([]);
      }
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
