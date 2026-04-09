import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Award, Building2, Loader2, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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

const EMPTY_ACCREDITATION: AccreditationMetric[] = [
  { metric: "Module Pass Rate (Avg)", value: 0, target: 75, status: "below" },
  { metric: "Graded Submissions", value: 0, target: 95, status: "below" },
  { metric: "Average Score", value: 0, target: 60, status: "below" },
  { metric: "Assessment Completion Rate", value: 0, target: 90, status: "below" },
];

const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
    <p className="font-medium text-foreground">{title}</p>
    <p className="mt-1">{description}</p>
  </div>
);

const getMetricStatus = (value: number, target: number): AccreditationMetric["status"] => {
  if (value >= target) return "met";
  if (value >= Math.max(target - 10, 0)) return "at-risk";
  return "below";
};

const InstitutionalInsights = () => {
  const { isDemo } = useAuth();
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

    const fetchData = async () => {
      try {
        const [assignRes, subRes, gradeRes] = await Promise.all([
          supabase.from("assignments").select("id, title, module_code"),
          supabase.from("submissions").select("id, assignment_id"),
          supabase.from("grades").select("submission_id, ai_score, final_score"),
        ]);

        const assignments = assignRes.data || [];
        const submissions = subRes.data || [];
        const grades = gradeRes.data || [];
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
              issue: average < 50 ? "Low average — review needed" : "Moderate performance",
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
        const completionRate = assignments.length > 0
          ? Math.min(Math.round((submissions.length / assignments.length) * 100), 100)
          : 0;

        setAccreditation([
          { metric: "Module Pass Rate (Avg)", value: passRate, target: 75, status: getMetricStatus(passRate, 75) },
          { metric: "Graded Submissions", value: gradedPct, target: 95, status: getMetricStatus(gradedPct, 95) },
          { metric: "Average Score", value: avgScore, target: 60, status: getMetricStatus(avgScore, 60) },
          { metric: "Assessment Completion Rate", value: completionRate, target: 90, status: getMetricStatus(completionRate, 90) },
        ]);
      } catch (err) {
        console.error("Failed to fetch institutional data:", err);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [isDemo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="flex items-center gap-2 p-3">
            <Badge variant="outline" className="border-warning text-warning">Demo</Badge>
            <span className="text-sm text-muted-foreground">Viewing demo institutional data</span>
          </CardContent>
        </Card>
      )}

      {!isDemo && !hasRealData && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            This page auto-populates after you create assignments, upload submissions, and complete grading.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /><CardTitle className="text-base">Department Performance</CardTitle></div>
          <CardDescription>Cross-department comparison from your live marking data</CardDescription>
        </CardHeader>
        <CardContent>
          {departmentStats.length === 0 && !isDemo ? (
            <EmptyState
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
                      <Badge variant={dept.passRate >= 80 ? "default" : dept.passRate >= 70 ? "secondary" : "destructive"}>{dept.passRate}% pass rate</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-6 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {dept.students} graded submissions</span>
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
            <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" /><CardTitle className="text-base">Low-Performing Assessments</CardTitle></div>
            <CardDescription>Assessments currently scoring lowest in live grading data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowPerforming.length === 0 && !isDemo ? (
              <EmptyState
                title="No low-performing assessments yet"
                description="This view fills in after submissions have been graded and score patterns can be compared."
              />
            ) : (
              lowPerforming.map((assessment) => (
                <div key={assessment.name} className="rounded-lg border border-warning/20 bg-warning/5 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium">{assessment.name}</span>
                    <span className="text-lg font-bold font-display text-destructive">{assessment.avgGrade}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{assessment.students} submissions · {assessment.passRate}% pass rate</p>
                  <Badge variant="outline" className="text-xs border-warning/30">{assessment.issue}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" /><CardTitle className="text-base">Accreditation Readiness</CardTitle></div>
            <CardDescription>Live compliance indicators based on uploaded marking activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {accreditation.map((metric) => (
              <div key={metric.metric} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{metric.metric}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{metric.value}%</span>
                    <Badge variant={metric.status === "met" ? "default" : metric.status === "at-risk" ? "secondary" : "destructive"} className="text-xs">
                      {metric.status === "met" ? "Met" : metric.status === "at-risk" ? "At Risk" : "Below"}
                    </Badge>
                  </div>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${metric.status === "met" ? "bg-success" : metric.status === "at-risk" ? "bg-warning" : "bg-destructive"}`} style={{ width: `${metric.value}%` }} />
                  <div className="absolute inset-y-0 w-0.5 bg-foreground/40" style={{ left: `${metric.target}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">Target: {metric.target}%</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InstitutionalInsights;
