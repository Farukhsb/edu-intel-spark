import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, ArrowRight, CheckCircle, Download, TrendingDown, TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { log } from "@/lib/logger";
import {
  DashboardEmptyState,
  DashboardLiveBanner,
  DashboardLoadingState,
} from "@/components/dashboard/PageStates";
import {
  loadLearningOutcomesData,
  type AssignmentOption,
  type OutcomeRow,
  type StudentTrajectory,
} from "@/lib/learningOutcomes";

const LearningOutcomes = () => {
  const { isDemo, user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("all");
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([]);
  const [trajectories, setTrajectories] = useState<StudentTrajectory[]>([]);
  const [loading, setLoading] = useState(!isDemo);

  useEffect(() => {
    if (isDemo) { setLoading(false); return; }
    if (!user) return;
    const fetchData = async () => {
      try {
        const data = await loadLearningOutcomesData({
          supabase,
          lecturerId: user.id,
          selectedAssignment,
        });
        setAssignments(data.assignments);
        setOutcomes(data.outcomes);
        setTrajectories(data.trajectories);
      } catch (err) {
        log.error("Learning outcomes fetch error", err);
      }
      setLoading(false);
    };
    fetchData();
  }, [isDemo, selectedAssignment, user]);

  if (loading) return <DashboardLoadingState />;

  const statusColor = (s: string) => s === "above" ? "bg-success" : s === "approaching" ? "bg-warning" : "bg-destructive";
  const statusBadge = (s: string) => s === "above" ? "default" : s === "approaching" ? "secondary" : "destructive";
  const statusLabel = (s: string) => s === "above" ? "Above" : s === "approaching" ? "Approaching" : "Below";
  const belowTargetOutcomes = outcomes.filter((outcome) => outcome.status !== "above");
  const decliningStudents = trajectories.filter((student) => student.trend === "declining");
  const selectedAssignmentLabel = selectedAssignment === "all"
    ? "all assignments"
    : assignments.find((assignment) => assignment.id === selectedAssignment)?.title || "selected assignment";

  const exportOutcomeSnapshot = () => {
    const lines = [
      "Learning Outcomes Snapshot",
      `Generated: ${new Date().toISOString().slice(0, 10)}`,
      `Scope: ${selectedAssignmentLabel}`,
      "",
      "Criterion,Average Score,Max Score,Percentage,Status",
    ];

    outcomes.forEach((outcome) => {
      lines.push(`"${outcome.criterion}",${outcome.avgScore},${outcome.maxScore},${outcome.pct}%,${statusLabel(outcome.status)}`);
    });

    lines.push("");
    lines.push("Student,Trend,Latest Score");
    trajectories.forEach((student) => {
      lines.push(`"${student.name}",${student.trend},${student.scores[student.scores.length - 1] ?? ""}`);
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `learning_outcomes_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="flex items-center gap-2 p-3">
            <Badge variant="outline" className="border-warning text-warning">Demo</Badge>
            <span className="text-sm text-muted-foreground">Viewing demo learning outcomes</span>
          </CardContent>
        </Card>
      )}

      {!isDemo && (
        <DashboardLiveBanner label="Viewing live learning outcomes for your lecturer-scoped assignments" />
      )}

      {!isDemo && assignments.length === 0 && (
        <DashboardEmptyState
          title="No learning outcomes data yet"
          description="This view fills in after you create assignments, receive submissions, and complete grading with rubric breakdowns."
        />
      )}

      {assignments.length > 0 && (
        <div className="flex items-center gap-4">
          <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
            <SelectTrigger className="w-[280px]"><SelectValue placeholder="Select assignment" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignments</SelectItem>
              {assignments.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.moduleCode ? `${a.moduleCode} — ` : ""}{a.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportOutcomeSnapshot} disabled={outcomes.length === 0}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Export snapshot
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Findings</CardTitle>
          <CardDescription>What this outcomes view is indicating from current rubric and trajectory data</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lowest rubric area</p>
            <p className="mt-2 text-sm font-semibold">
              {belowTargetOutcomes[0]?.criterion || "No weak criterion detected"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {belowTargetOutcomes[0]
                ? `${belowTargetOutcomes[0].pct}% achievement. This is the clearest remediation target in ${selectedAssignmentLabel}.`
                : "Current rubric results are already meeting the benchmark."}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Declining trajectories</p>
            <p className="mt-2 text-sm font-semibold">{decliningStudents.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {decliningStudents.length > 0
                ? "Open performance insights and review students whose latest graded result dropped materially from the previous one."
                : "No declining multi-submission trajectory detected in this view."}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended lecturer action</p>
            <p className="mt-2 text-sm font-semibold">
              {belowTargetOutcomes.length > 0 ? "Target feedback to weak criteria" : "Sustain strong performance"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {belowTargetOutcomes.length > 0
                ? "Use the weakest criterion to shape feedback summaries and improvement tasks."
                : "Use high-performing criteria as exemplars for the rest of the cohort."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recommended Actions</CardTitle>
          <CardDescription>Move directly from analysis to the right workflow</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <button
            type="button"
            className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40"
            onClick={() => navigate("/dashboard/performance?risk=high-plus")}
          >
            <p className="text-sm font-medium">Review declining students</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Open the performance workflow and review students whose recent graded trajectory is slipping.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open performance workflow <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
          <button
            type="button"
            className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40"
            onClick={() => navigate("/dashboard/assignments?view=needs-review")}
          >
            <p className="text-sm font-medium">Tighten pending feedback</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Go straight to the submissions queue and push rubric-specific feedback into live marking.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open pending queue <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
          <button
            type="button"
            className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40"
            onClick={() => navigate("/dashboard/improvements")}
          >
            <p className="text-sm font-medium">Check student improvement plans</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirm weak criteria are turning into visible study tasks on the student side.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open student plan view <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rubric Criterion Achievement</CardTitle>
          <CardDescription>Average scores per rubric criterion across graded submissions</CardDescription>
        </CardHeader>
        <CardContent>
          {outcomes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No rubric breakdown data available yet. Grades need AI breakdown to populate this view.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Criterion</TableHead>
                  <TableHead className="text-center w-[100px]">Avg Score</TableHead>
                  <TableHead className="text-center w-[80px]">Max</TableHead>
                  <TableHead className="w-[200px]">Progress</TableHead>
                  <TableHead className="text-center w-[100px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outcomes.map((lo, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{lo.criterion}</TableCell>
                    <TableCell className="text-center font-bold">{lo.avgScore}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{lo.maxScore}</TableCell>
                    <TableCell>
                      <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full transition-all ${statusColor(lo.status)}`} style={{ width: `${Math.min(lo.pct, 100)}%` }} />
                        <div className="absolute inset-y-0 w-0.5 bg-foreground/50" style={{ left: "70%" }} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusBadge(lo.status) as any} className="text-xs">{statusLabel(lo.status)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {trajectories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student Achievement Trajectories</CardTitle>
            <CardDescription>Students with multiple graded submissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {trajectories.map((student, i) => {
              const latest = student.scores[student.scores.length - 1];
              const prev = student.scores.length >= 2 ? student.scores[student.scores.length - 2] : latest;
              const diff = latest - prev;
              const chartData = student.scores.map((g, idx) => ({ a: `A${idx + 1}`, grade: g }));

              return (
                <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{student.name}</span>
                      {student.trend === "improving" ? (
                        <TrendingUp className="h-3.5 w-3.5 text-success" />
                      ) : student.trend === "declining" ? (
                        <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Latest: {latest}% ({diff > 0 ? "+" : ""}{diff}%)
                    </p>
                  </div>
                  <div className="w-[120px] h-[40px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <Line
                          type="monotone"
                          dataKey="grade"
                          stroke={student.trend === "improving" ? "hsl(var(--success))" : student.trend === "declining" ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LearningOutcomes;
