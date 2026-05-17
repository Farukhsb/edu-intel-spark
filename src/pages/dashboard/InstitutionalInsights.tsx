import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, Award, Building2, Download, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { getAssignmentWorkflowTargetFromStats } from "@/lib/assignmentWorkflowNavigation";
import { fetchProgrammeReportDataset } from "@/lib/data/academic";
import { log } from "@/lib/logger";
import {
  buildInstitutionalInsightsSnapshot,
  type AccreditationMetric,
  type ModuleStat,
  EMPTY_ACCREDITATION,
  getInstitutionalReportingReadiness,
  type LowPerformingAssessment,
} from "@/lib/institutionalInsights";
import {
  DashboardDemoBanner,
  DashboardEmptyState,
  DashboardLoadingState,
} from "@/components/dashboard/PageStates";

const InstitutionalInsights = () => {
  const { isDemo } = useAuth();
  const navigate = useNavigate();
  const [moduleStats, setModuleStats] = useState<ModuleStat[]>([]);
  const [lowPerforming, setLowPerforming] = useState<LowPerformingAssessment[]>([]);
  const [accreditation, setAccreditation] = useState<AccreditationMetric[]>(EMPTY_ACCREDITATION);
  const [loading, setLoading] = useState(!isDemo);
  const [hasRealData, setHasRealData] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (isDemo) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const { assignments, submissions, grades, profiles } = await fetchProgrammeReportDataset();
        const snapshot = buildInstitutionalInsightsSnapshot({
          assignments,
          submissions,
          grades,
          profiles,
        });
        const hasUsableData = snapshot.hasRealData;

        setHasRealData(hasUsableData);
        setLoadError(false);

        if (!hasUsableData) {
          setModuleStats([]);
          setLowPerforming([]);
          setAccreditation(EMPTY_ACCREDITATION);
          return;
        }

        setModuleStats(snapshot.moduleStats);
        setLowPerforming(snapshot.lowPerforming);
        setAccreditation(snapshot.accreditation);
      } catch (error) {
        log.error("Failed to fetch institutional data", error);
        setHasRealData(false);
        setLoadError(true);
        setModuleStats([]);
        setLowPerforming([]);
        setAccreditation(EMPTY_ACCREDITATION);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [isDemo]);

  if (loading) {
    return <DashboardLoadingState />;
  }

  if (loadError) {
    return (
      <DashboardEmptyState
        title="Institutional reporting is unavailable"
        description="Institutional insights could not be loaded right now. Try again later."
      />
    );
  }

  if (!isDemo && !hasRealData) {
    return (
      <DashboardEmptyState
        title="No institutional data yet"
        description="This page auto-populates after assignments, submissions, and grading activity exist in the live dataset."
      />
    );
  }

  const weakestModule = [...moduleStats].sort((left, right) => left.passRate - right.passRate)[0];
  const weakestAssessment = lowPerforming[0];
  const weakestAccreditationMetric = [...accreditation].sort((left, right) => left.value - right.value)[0];
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
  const reportingReadiness = getInstitutionalReportingReadiness({
    accreditation,
    lowPerforming,
  });

  const exportInsightsSnapshot = () => {
    const lines = [
      "Institutional Insights Snapshot",
      `Generated: ${new Date().toISOString().slice(0, 10)}`,
      "",
      "Module,Students,Average Grade,Pass Rate",
    ];

    moduleStats.forEach((module) => {
      lines.push(`"${module.module}",${module.students},${module.avgGrade}%,${module.passRate}%`);
    });

    lines.push("");
    lines.push("Assessment,Average Grade,Pass Rate,Students,Issue");
    lowPerforming.forEach((assessment) => {
      lines.push(`"${assessment.name}",${assessment.avgGrade}%,${assessment.passRate}%,${assessment.students},"${assessment.issue}"`);
    });

    lines.push("");
    lines.push("Metric,Value,Target,Status");
    accreditation.forEach((metric) => {
      lines.push(`"${metric.metric}",${metric.value}%,${metric.target}%,${metric.status}`);
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `institutional_insights_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && (
        <DashboardDemoBanner label="Viewing demo institutional data" />
      )}

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
            <p className="mt-1 text-sm text-muted-foreground">
              Based on current accreditation-style thresholds across grading, pass-rate, and completion signals.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Likely first challenge</p>
            <p className="mt-2 text-sm font-semibold">{reportingReadiness.likelyChallenge}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This is the line most likely to need a concrete explanation in a reporting or quality-review context.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next report</p>
            <p className="mt-2 text-sm font-semibold">{reportingReadiness.bestNextReport}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use this to decide whether to move into accreditation detail or stay at institutional snapshot level first.
            </p>
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
                ? `${weakestModule.passRate}% pass rate with ${weakestModule.avgGrade}% average. This is the clearest module-level concern in your data.`
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
            onClick={() =>
              navigate(
                weakestAssessmentWorkflowTarget?.href ?? "/dashboard/assignments?view=needs-review",
              )
            }
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
            onClick={() => navigate("/dashboard?view=submissions")}
          >
            <p className="text-sm font-medium">Review low-performing student signals</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Open the admin oversight view to review the submissions and result patterns most likely to be dragging down module and pass-rate performance.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open submission oversight <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
          <button
            type="button"
            className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40"
            onClick={() => navigate("/dashboard/accreditation")}
          >
            <p className="text-sm font-medium">Prepare compliance evidence</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Move into accreditation reporting to review the exact metrics and exported evidence likely to be scrutinised.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open accreditation view <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Module Performance</CardTitle>
          </div>
          <CardDescription>Cross-module comparison from your live marking data</CardDescription>
        </CardHeader>
        <CardContent>
            {moduleStats.length === 0 && !isDemo ? (
            <DashboardEmptyState
              title="No module performance data yet"
              description="Module-level comparisons appear here once graded submissions exist in the system."
            />
          ) : (
            <div className="space-y-3">
              {moduleStats.map((module) => (
                <div key={module.module} className="flex items-center gap-4 rounded-lg border p-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{module.module}</span>
                      <Badge variant={module.passRate >= 80 ? "default" : module.passRate >= 70 ? "secondary" : "destructive"}>
                        {module.passRate}% pass rate
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-6 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {module.students} graded submissions
                      </span>
                      <span>Avg: {module.avgGrade}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <CardTitle className="text-base">Low-Performing Assessments</CardTitle>
            </div>
            <CardDescription>Assessments currently scoring lowest in live grading data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowPerforming.length === 0 && !isDemo ? (
              <DashboardEmptyState
                title="No low-performing assessments yet"
                description="This view fills in after submissions have been graded and score patterns can be compared."
              />
            ) : (
              lowPerforming.map((assessment) => (
                <div key={assessment.name} className="space-y-2 rounded-lg border border-warning/20 bg-warning/5 p-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium">{assessment.name}</span>
                    <span className="text-lg font-bold font-display text-destructive">{assessment.avgGrade}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {assessment.students} submissions - {assessment.passRate}% pass rate
                  </p>
                  <Badge variant="outline" className="border-warning/30 text-xs">{assessment.issue}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Accreditation Readiness</CardTitle>
            </div>
            <CardDescription>Live compliance indicators based on uploaded marking activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isDemo && !hasRealData ? (
              <DashboardEmptyState
                title="No accreditation metrics yet"
                description="Compliance indicators appear here once assignments, submissions, and grading data start building up."
              />
            ) : (
              accreditation.map((metric) => (
                <div key={metric.metric} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{metric.metric}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{metric.value}%</span>
                      <Badge
                        variant={metric.status === "met" ? "default" : metric.status === "at-risk" ? "secondary" : "destructive"}
                        className="text-xs"
                      >
                        {metric.status === "met" ? "Met" : metric.status === "at-risk" ? "At Risk" : "Below"}
                      </Badge>
                    </div>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${metric.status === "met" ? "bg-success" : metric.status === "at-risk" ? "bg-warning" : "bg-destructive"}`}
                      style={{ width: `${metric.value}%` }}
                    />
                    <div className="absolute inset-y-0 w-0.5 bg-foreground/40" style={{ left: `${metric.target}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">Target: {metric.target}%</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InstitutionalInsights;
