import { ArrowRight, Download, TrendingDown, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardDemoBanner } from "@/components/dashboard/PageStates";
import {
  getLearningOutcomesReportingReadiness,
  type AssignmentOption,
  type OutcomeRow,
  type StudentTrajectory,
} from "@/lib/learningOutcomes";
import { getAssignmentWorkflowTarget } from "@/lib/assignmentWorkflowNavigation";

const DEMO_ASSIGNMENTS: AssignmentOption[] = [
  { id: "demo-lo-1", title: "Public Policy Evaluation", moduleCode: "PPL502" },
  { id: "demo-lo-2", title: "Social Research Methods", moduleCode: "SOC411" },
];

const DEMO_OUTCOMES: OutcomeRow[] = [
  { criterion: "Argument Structure", avgScore: 7.4, maxScore: 10, pct: 74, status: "above" },
  { criterion: "Evidence Use", avgScore: 6.1, maxScore: 10, pct: 61, status: "approaching" },
  { criterion: "Critical Reflection", avgScore: 5.2, maxScore: 10, pct: 52, status: "approaching" },
  { criterion: "Policy Application", avgScore: 4.6, maxScore: 10, pct: 46, status: "below" },
];

const DEMO_TRAJECTORIES: StudentTrajectory[] = [
  { name: "Amina Hassan", scores: [62, 67, 71], trend: "improving" },
  { name: "Daniel Reed", scores: [66, 63, 61], trend: "declining" },
  { name: "Farah Khan", scores: [58, 59, 59], trend: "stable" },
];

const DemoLearningOutcomes = () => {
  const navigate = useNavigate();
  const selectedAssignmentLabel = "all assignments";
  const reportingReadiness = getLearningOutcomesReportingReadiness({
    outcomes: DEMO_OUTCOMES,
    trajectories: DEMO_TRAJECTORIES,
  });
  const belowTargetOutcomes = DEMO_OUTCOMES.filter((outcome) => outcome.status !== "above");
  const decliningStudents = DEMO_TRAJECTORIES.filter((student) => student.trend === "declining");
  const assignmentWorkflowTarget = getAssignmentWorkflowTarget({
    assignmentId: DEMO_ASSIGNMENTS[0].id,
    status: "ai_graded",
  });

  const exportOutcomeSnapshot = () => {
    const lines = [
      "Learning Outcomes Snapshot",
      `Generated: ${new Date().toISOString().slice(0, 10)}`,
      `Scope: ${selectedAssignmentLabel}`,
      "",
      "Criterion,Average Score,Max Score,Percentage,Status",
    ];

    DEMO_OUTCOMES.forEach((outcome) => {
      lines.push(`"${outcome.criterion}",${outcome.avgScore},${outcome.maxScore},${outcome.pct}%,${outcome.status}`);
    });

    lines.push("");
    lines.push("Student,Trend,Latest Score");
    DEMO_TRAJECTORIES.forEach((student) => {
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

  const statusColor = (s: string) => (s === "above" ? "bg-success" : s === "approaching" ? "bg-warning" : "bg-destructive");
  const statusBadge = (s: string) => (s === "above" ? "default" : s === "approaching" ? "secondary" : "destructive");
  type BadgeVariant = NonNullable<BadgeProps["variant"]>;
  const statusLabel = (s: string) => (s === "above" ? "Above" : s === "approaching" ? "Approaching" : "Below");

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardDemoBanner label="Viewing demo learning outcomes" />

      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={exportOutcomeSnapshot}>
          <Download className="mr-2 h-3.5 w-3.5" />
          Export snapshot
        </Button>
      </div>

      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-base">Teaching Focus</CardTitle>
          <CardDescription>A compact reading of what this outcomes view is most likely to need from you next.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current position</p>
            <p className="mt-2 text-sm font-semibold">{reportingReadiness.postureLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">Based on the demo rubric and trajectory signals.</p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What needs attention</p>
            <p className="mt-2 text-sm font-semibold">{reportingReadiness.likelyChallenge}</p>
            <p className="mt-1 text-sm text-muted-foreground">This is the criterion most likely to raise questions about teaching, feedback, or rubric alignment.</p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next step</p>
            <p className="mt-2 text-sm font-semibold">{reportingReadiness.bestNextAction}</p>
            <p className="mt-1 text-sm text-muted-foreground">Use this to decide whether to act on student trajectories or criterion-level feedback first.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Findings</CardTitle>
          <CardDescription>What this outcomes view is indicating from demo rubric and trajectory data</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lowest rubric area</p>
            <p className="mt-2 text-sm font-semibold">{belowTargetOutcomes[0]?.criterion || "No weak criterion detected"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {belowTargetOutcomes[0]
                ? `${belowTargetOutcomes[0].pct}% achievement. This is the clearest remediation target in the demo dataset.`
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
          <button type="button" className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40" onClick={() => navigate("/demo/dashboard/performance?risk=high-plus")}>
            <p className="text-sm font-medium">Review declining students</p>
            <p className="mt-1 text-sm text-muted-foreground">Open the demo performance workflow and review students whose recent graded trajectory is slipping.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open performance workflow <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
          <button type="button" className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40" onClick={() => navigate(assignmentWorkflowTarget?.href ?? "/demo/dashboard/assignments?view=needs-review")}>
            <p className="text-sm font-medium">Tighten pending feedback</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {assignmentWorkflowTarget
                ? "Open this assignment's grading workflow and turn weak rubric signals into live marking action."
                : "Go straight to the submissions queue and push rubric-specific feedback into live marking."}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              {assignmentWorkflowTarget ? assignmentWorkflowTarget.label : "Open pending queue"} <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
          <button type="button" className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40" onClick={() => navigate("/demo/dashboard/performance?risk=high-plus")}>
            <p className="text-sm font-medium">Review student support risk</p>
            <p className="mt-1 text-sm text-muted-foreground">Open the demo performance workflow and review which students need support against the weak criteria shown here.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open performance workflow <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rubric Criterion Achievement</CardTitle>
          <CardDescription>Average scores per rubric criterion across demo graded submissions</CardDescription>
        </CardHeader>
        <CardContent>
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
              {DEMO_OUTCOMES.map((lo, i) => (
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
                    <Badge variant={statusBadge(lo.status) as BadgeVariant} className="text-xs">{statusLabel(lo.status)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Student Achievement Trajectories</CardTitle>
          <CardDescription>Students with multiple graded submissions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DEMO_TRAJECTORIES.map((student, i) => {
            const latest = student.scores[student.scores.length - 1];
            const prev = student.scores.length >= 2 ? student.scores[student.scores.length - 2] : latest;
            const diff = latest - prev;
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
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default DemoLearningOutcomes;
