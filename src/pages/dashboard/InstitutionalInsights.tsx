import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, Award, Building2, Download, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { fetchInstitutionalInsightsDataset } from "@/lib/data/academic";
import { log } from "@/lib/logger";
import {
  EMPTY_ACCREDITATION,
  getInstitutionalReportingReadiness,
} from "@/lib/institutionalInsights";
import {
  DashboardDemoBanner,
  DashboardEmptyState,
  DashboardLoadingState,
} from "@/components/dashboard/PageStates";

type DepartmentStat = {
  dept: string;
  students: number;
  avgGrade: number;
  passRate: number;
};

type LowPerformingAssessment = {
  name: string;
  avgGrade: number;
  passRate: number;
  students: number;
  issue: string;
};

type AccreditationMetric = {
  metric: string;
  value: number;
  target: number;
  status: "met" | "at-risk" | "below";
};

const getMetricStatus = (value: number, target: number): AccreditationMetric["status"] => {
  if (value >= target) return "met";
  if (value >= Math.max(target - 10, 0)) return "at-risk";
  return "below";
};

const InstitutionalInsights = () => {
  const { isDemo, user } = useAuth();
  const navigate = useNavigate();
  const [departmentStats, setDepartmentStats] = useState<DepartmentStat[]>([]);
  const [lowPerforming, setLowPerforming] = useState<LowPerformingAssessment[]>([]);
  const [accreditation, setAccreditation] = useState<AccreditationMetric[]>(EMPTY_ACCREDITATION);
  const [loading, setLoading] = useState(!isDemo);
  const [hasRealData, setHasRealData] = useState(false);

  useEffect(() => {
    if (isDemo) {
      setLoading(false);
      return;
    }

    if (!user) return;

    const fetchData = async () => {
      try {
        const { assignments, submissions, grades } = await fetchInstitutionalInsightsDataset(user.id);

        if (assignments.length === 0) {
          setHasRealData(false);
          setDepartmentStats([]);
          setLowPerforming([]);
          setAccreditation(EMPTY_ACCREDITATION);
          setLoading(false);
          return;
        }

        const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));

        const scores = grades
          .map((grade) => Number(grade.final_score ?? grade.ai_score))
          .filter((score) => Number.isFinite(score));

        setHasRealData(assignments.length > 0 || submissions.length > 0 || grades.length > 0);

        const gradeBySubmission: Record<string, number> = {};
        grades.forEach((grade) => {
          const score = Number(grade.final_score ?? grade.ai_score);
          if (Number.isFinite(score)) {
            gradeBySubmission[grade.submission_id] = score;
          }
        });

        const assignmentScores: Record<string, { title: string; scores: number[]; students: number }> = {};
        assignments.forEach((assignment) => {
          assignmentScores[assignment.id] = { title: assignment.title, scores: [], students: 0 };
        });

        submissions.forEach((submission) => {
          const stats = assignmentScores[submission.assignment_id];
          if (!stats) return;

          stats.students += 1;
          const score = gradeBySubmission[submission.id];
          if (Number.isFinite(score)) {
            stats.scores.push(score);
          }
        });

        const lowPerf = Object.values(assignmentScores)
          .filter((assignment) => assignment.scores.length > 0)
          .map((assignment) => {
            const average = assignment.scores.reduce((sum, score) => sum + score, 0) / assignment.scores.length;
            return {
              name: assignment.title,
              avgGrade: Math.round(average),
              passRate: Math.round((assignment.scores.filter((score) => score >= 40).length / assignment.scores.length) * 100),
              students: assignment.students,
              issue: average < 50 ? "Low average - review needed" : "Moderate performance",
            };
          })
          .sort((a, b) => a.avgGrade - b.avgGrade)
          .slice(0, 5);

        setLowPerforming(lowPerf);

        const moduleGroups: Record<string, number[]> = {};
        submissions.forEach((submission) => {
          const assignment = assignmentById.get(submission.assignment_id);
          const key = assignment?.module_code?.trim() || "Unassigned module";
          const score = gradeBySubmission[submission.id];

          if (!moduleGroups[key]) {
            moduleGroups[key] = [];
          }

          if (Number.isFinite(score)) {
            moduleGroups[key].push(score);
          }
        });

        const deptStats = Object.entries(moduleGroups)
          .filter(([, moduleScores]) => moduleScores.length > 0)
          .map(([moduleCode, moduleScores]) => ({
            dept: moduleCode,
            students: moduleScores.length,
            avgGrade: Math.round(moduleScores.reduce((sum, score) => sum + score, 0) / moduleScores.length),
            passRate: Math.round((moduleScores.filter((score) => score >= 40).length / moduleScores.length) * 100),
          }))
          .sort((a, b) => b.passRate - a.passRate);

        setDepartmentStats(deptStats);

        const passRate = scores.length > 0 ? Math.round((scores.filter((score) => score >= 40).length / scores.length) * 100) : 0;
        const gradedPct = submissions.length > 0 ? Math.min(Math.round((grades.length / submissions.length) * 100), 100) : 0;
        const avgScore = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
        const completionRate = assignments.length > 0 ? Math.min(Math.round((submissions.length / assignments.length) * 100), 100) : 0;

        setAccreditation([
          { metric: "Module Pass Rate (Avg)", value: passRate, target: 75, status: getMetricStatus(passRate, 75) },
          { metric: "Graded Submissions", value: gradedPct, target: 95, status: getMetricStatus(gradedPct, 95) },
          { metric: "Average Score", value: avgScore, target: 60, status: getMetricStatus(avgScore, 60) },
          { metric: "Assessment Completion Rate", value: completionRate, target: 90, status: getMetricStatus(completionRate, 90) },
        ]);
      } catch (error) {
        log.error("Failed to fetch institutional data", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [isDemo, user?.id]);

  if (loading) {
    return <DashboardLoadingState />;
  }

  const weakestDepartment = [...departmentStats].sort((left, right) => left.passRate - right.passRate)[0];
  const weakestAssessment = lowPerforming[0];
  const weakestAccreditationMetric = [...accreditation].sort((left, right) => left.value - right.value)[0];
  const reportingReadiness = getInstitutionalReportingReadiness({
    accreditation,
    lowPerforming,
  });

  const exportInsightsSnapshot = () => {
    const lines = [
      "Institutional Insights Snapshot",
      `Generated: ${new Date().toISOString().slice(0, 10)}`,
      "",
      "Department,Students,Average Grade,Pass Rate",
    ];

    departmentStats.forEach((department) => {
      lines.push(`"${department.dept}",${department.students},${department.avgGrade}%,${department.passRate}%`);
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

      {!isDemo && !hasRealData && (
        <DashboardEmptyState
          title="No institutional data yet"
          description="This page auto-populates after you create assignments, upload submissions, and complete grading."
        />
      )}

      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={exportInsightsSnapshot} disabled={!hasRealData && !isDemo}>
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
            <p className="mt-2 text-sm font-semibold">{weakestDepartment?.dept || "No department comparison yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {weakestDepartment
                ? `${weakestDepartment.passRate}% pass rate with ${weakestDepartment.avgGrade}% average. This is the clearest module-level concern in your data.`
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
            onClick={() => navigate("/dashboard/assignments?view=needs-review")}
          >
            <p className="text-sm font-medium">Clear grading bottlenecks</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pending grading and release work drags down completion, readiness, and feedback quality at the institutional level.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open assignment queue <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
          <button
            type="button"
            className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40"
            onClick={() => navigate("/dashboard/performance?risk=high-plus")}
          >
            <p className="text-sm font-medium">Intervene with low-performing students</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the risk workflow to act on the students most likely to be pulling down module and pass-rate performance.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open risk workflow <ArrowRight className="h-3.5 w-3.5" />
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
            <CardTitle className="text-base">Department Performance</CardTitle>
          </div>
          <CardDescription>Cross-department comparison from your live marking data</CardDescription>
        </CardHeader>
        <CardContent>
            {departmentStats.length === 0 && !isDemo ? (
            <DashboardEmptyState
              title="No department performance data yet"
              description="Module-level comparisons appear here once graded submissions exist in the system."
            />
          ) : (
            <div className="space-y-3">
              {departmentStats.map((dept) => (
                <div key={dept.dept} className="flex items-center gap-4 rounded-lg border p-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{dept.dept}</span>
                      <Badge variant={dept.passRate >= 80 ? "default" : dept.passRate >= 70 ? "secondary" : "destructive"}>
                        {dept.passRate}% pass rate
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-6 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {dept.students} graded submissions
                      </span>
                      <span>Avg: {dept.avgGrade}%</span>
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
