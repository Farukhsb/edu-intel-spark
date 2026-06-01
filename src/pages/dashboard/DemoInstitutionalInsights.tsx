import { ArrowRight, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardDemoBanner } from "@/components/dashboard/PageStates";
import { getAssignmentWorkflowTargetFromStats } from "@/lib/assignmentWorkflowNavigation";
import {
  getInstitutionalReportingReadiness,
  type AccreditationMetric,
  type LowPerformingAssessment,
  type ModuleStat,
} from "@/lib/institutionalInsights";

const DEMO_MODULE_STATS: ModuleStat[] = [
  { module: "PPL502", students: 48, avgGrade: 69, passRate: 92 },
  { module: "SOC411", students: 44, avgGrade: 61, passRate: 81 },
  { module: "EDU320", students: 39, avgGrade: 55, passRate: 74 },
];

const DEMO_LOW_PERFORMING: LowPerformingAssessment[] = [
  { id: "demo-assessment-1", name: "Research Ethics Review Memo", avgGrade: 55, passRate: 74, students: 39, issue: "Critical reflection and justification need stronger evidence." },
  { id: "demo-assessment-2", name: "Policy Brief Draft", avgGrade: 61, passRate: 81, students: 44, issue: "Implementation detail and risk analysis need tightening." },
];

const DEMO_ACCREDITATION: AccreditationMetric[] = [
  { metric: "Moderation completion", value: 88, target: 95, status: "at-risk" },
  { metric: "Release coverage", value: 91, target: 95, status: "at-risk" },
  { metric: "Evidence completeness", value: 83, target: 90, status: "below" },
  { metric: "Assessment turnaround", value: 97, target: 90, status: "met" },
];

const DemoInstitutionalInsights = () => {
  const navigate = useNavigate();
  const reportingReadiness = getInstitutionalReportingReadiness({
    accreditation: DEMO_ACCREDITATION,
    lowPerforming: DEMO_LOW_PERFORMING,
  });
  const weakestModule = [...DEMO_MODULE_STATS].sort((left, right) => left.passRate - right.passRate)[0];
  const weakestAssessment = DEMO_LOW_PERFORMING[0];
  const weakestAccreditationMetric = [...DEMO_ACCREDITATION].sort((left, right) => left.value - right.value)[0];
  const weakestAssessmentWorkflowTarget = weakestAssessment
    ? getAssignmentWorkflowTargetFromStats({
        assignmentId: weakestAssessment.id,
        stats: {
          total: weakestAssessment.students,
          needsReview: 0,
          graded: weakestAssessment.students,
          approved: 0,
          released: 0,
        },
      })
    : null;

  const exportInsightsSnapshot = () => {
    const lines = [
      "Institutional Insights Snapshot",
      `Generated: ${new Date().toISOString().slice(0, 10)}`,
      "Scope: Demo institutional dataset",
      "",
      "Module,Students,Average Grade,Pass Rate",
    ];

    DEMO_MODULE_STATS.forEach((module) => {
      lines.push(`"${module.module}",${module.students},${module.avgGrade}%,${module.passRate}%`);
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `institutional_insights_demo_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardDemoBanner label="Viewing demo institutional data" />

      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={exportInsightsSnapshot}>
          <Download className="mr-2 h-3.5 w-3.5" />
          Export snapshot
        </Button>
      </div>

      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-base">Reporting Readiness</CardTitle>
          <CardDescription>
            The shortest path from institutional signal to the report line most likely to need explanation.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current posture</p>
            <p className="mt-2 text-sm font-semibold">{reportingReadiness.postureLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">Based on demo accreditation-style thresholds across grading, pass-rate, and completion signals.</p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Likely first challenge</p>
            <p className="mt-2 text-sm font-semibold">{reportingReadiness.likelyChallenge}</p>
            <p className="mt-1 text-sm text-muted-foreground">This is the line most likely to need a concrete explanation in a reporting or quality-review context.</p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next report</p>
            <p className="mt-2 text-sm font-semibold">{reportingReadiness.bestNextReport}</p>
            <p className="mt-1 text-sm text-muted-foreground">Use this to decide whether to move into accreditation detail or stay at institutional snapshot level first.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Findings</CardTitle>
          <CardDescription>Institution-level signals that need action rather than observation</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Weakest module grouping</p>
            <p className="mt-2 text-sm font-semibold">{weakestModule?.module || "No module comparison yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {weakestModule
                ? `${weakestModule.passRate}% pass rate with ${weakestModule.avgGrade}% average. This is the clearest module-level concern in the demo data.`
                : "Module-level comparisons appear once graded submissions accumulate."}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assessment needing review</p>
            <p className="mt-2 text-sm font-semibold">{weakestAssessment?.name || "No assessment issue detected yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {weakestAssessment
                ? `${weakestAssessment.avgGrade}% average and ${weakestAssessment.passRate}% pass rate. This is the best place to investigate assignment design or marking friction.`
                : "Assessment issue patterns appear after more grading data is available."}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Compliance pressure point</p>
            <p className="mt-2 text-sm font-semibold">{weakestAccreditationMetric?.metric || "No readiness signal yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {weakestAccreditationMetric
                ? `${weakestAccreditationMetric.value}% against a ${weakestAccreditationMetric.target}% target. This would be the first metric to tighten for reporting.`
                : "Readiness metrics appear once there is real assessment activity to assess."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recommended Actions</CardTitle>
          <CardDescription>Use these routes to move from institutional signal to intervention</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <button
            type="button"
            className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40"
            onClick={() => navigate(weakestAssessmentWorkflowTarget?.href ?? "/demo/dashboard/assignments?view=needs-review")}
          >
            <p className="text-sm font-medium">Clear grading bottlenecks</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pending grading and release work drags down completion, readiness, and feedback quality at the institutional level.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              {weakestAssessmentWorkflowTarget?.label ?? "Open assignment queue"} <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
          <button
            type="button"
            className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40"
            onClick={() => navigate("/demo/dashboard/accreditation")}
          >
            <p className="text-sm font-medium">Review accreditation detail</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the demo accreditation dashboard to inspect the evidence behind the readiness signal.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open accreditation view <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
          <button
            type="button"
            className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40"
            onClick={() => navigate("/demo/dashboard/performance?risk=high-plus")}
          >
            <p className="text-sm font-medium">Track student support risk</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Open the demo performance workflow and review which students need support across the weakest signals.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open performance workflow <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DemoInstitutionalInsights;
