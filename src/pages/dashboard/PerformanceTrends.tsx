import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingDown, TrendingUp, AlertTriangle, Lightbulb, User, Loader2, Bell, BellRing } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ASSIGNMENT_FIELDS = "id, title, module_code";
const SUBMISSION_FIELDS = "id, assignment_id, student_id, student_name, student_email, submitted_at";
const GRADE_FIELDS = "submission_id, ai_score, final_score";

interface StudentTrajectory {
  name: string;
  email: string | null;
  studentId: string;
  scores: { score: number; date: string; assignmentTitle: string }[];
}

interface AtRiskStudent {
  name: string;
  email: string | null;
  studentId: string;
  riskScore: number;
  riskLevel: "critical" | "high" | "moderate";
  avgGrade: number;
  lastGrade: number;
  trend: "declining" | "stable-low" | "volatile";
  flags: string[];
  sparkline: number[];
  recommendation: string;
  predictedNext: number;
}

function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }

  const denom = n * sumXX - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function computeRisk(trajectory: StudentTrajectory): AtRiskStudent | null {
  const scores = trajectory.scores.map((entry) => entry.score);
  if (scores.length === 0) return null;

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const last = scores[scores.length - 1];
  const { slope, intercept } = linearRegression(scores);
  const predictedNext = Math.max(0, Math.min(100, slope * scores.length + intercept));

  let riskScore = 0;
  const flags: string[] = [];

  if (avg < 40) {
    riskScore += 30;
    flags.push("Average below 40%");
  } else if (avg < 50) {
    riskScore += 20;
    flags.push("Average below 50%");
  }

  if (slope < -3) {
    riskScore += 25;
    flags.push("Steep grade decline");
  } else if (slope < -1) {
    riskScore += 15;
    flags.push("Gradual grade decline");
  }

  if (scores.length >= 2 && last < avg - 15) {
    riskScore += 15;
    flags.push("Sudden drop in last grade");
  }

  if (predictedNext < 40) {
    riskScore += 15;
    flags.push(`Predicted next: ${Math.round(predictedNext)}%`);
  }

  if (scores.length >= 3) {
    const mean = avg;
    const variance = scores.reduce((sum, value) => sum + (value - mean) ** 2, 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev > 15) {
      riskScore += 10;
      flags.push("Highly inconsistent grades");
    }
  }

  if (scores.length === 1 && last < 50) {
    riskScore += 10;
    flags.push("Only 1 submission graded");
  }

  riskScore = Math.min(100, riskScore);
  if (riskScore < 25) return null;

  const trend: AtRiskStudent["trend"] = slope < -1 ? "declining" : avg < 50 ? "stable-low" : "volatile";
  const riskLevel: AtRiskStudent["riskLevel"] = riskScore >= 70 ? "critical" : riskScore >= 45 ? "high" : "moderate";

  const recommendations: string[] = [];
  if (slope < -3) recommendations.push("Urgent: schedule 1-on-1 meeting to discuss grade trajectory.");
  if (avg < 40) recommendations.push("Refer to student support services and consider tutoring.");
  if (last < avg - 15) recommendations.push("Recent performance dip - check for personal or academic issues.");
  if (predictedNext < 40) recommendations.push("Predicted to fail next assessment - consider intervention before deadline.");
  if (scores.length === 1) recommendations.push("Limited data - monitor closely after next submission.");
  if (recommendations.length === 0) {
    recommendations.push("Schedule check-in to discuss study strategies and provide additional resources.");
  }

  return {
    name: trajectory.name,
    email: trajectory.email,
    studentId: trajectory.studentId,
    riskScore,
    riskLevel,
    avgGrade: Math.round(avg),
    lastGrade: Math.round(last),
    trend,
    flags,
    sparkline: scores.slice(-6),
    recommendation: recommendations.join(" "),
    predictedNext: Math.round(predictedNext),
  };
}

const EMPTY_GRADE_DIST = [
  { band: "1st (70-100%)", count: 0, percentage: 0, fill: "hsl(152, 56%, 45%)" },
  { band: "2:1 (60-69%)", count: 0, percentage: 0, fill: "hsl(205, 80%, 55%)" },
  { band: "2:2 (50-59%)", count: 0, percentage: 0, fill: "hsl(38, 92%, 60%)" },
  { band: "3rd (40-49%)", count: 0, percentage: 0, fill: "hsl(280, 55%, 55%)" },
  { band: "Fail (<40%)", count: 0, percentage: 0, fill: "hsl(0, 72%, 55%)" },
];

const PerformanceTrends = () => {
  const { user, isDemo } = useAuth();
  const { toast } = useToast();
  const [moduleFilter, setModuleFilter] = useState("all");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [alertsDismissed, setAlertsDismissed] = useState(false);
  const [modules, setModules] = useState<string[]>([]);
  const [assessmentTrends, setAssessmentTrends] = useState<{ name: string; avgGrade: number; participation: number }[]>([]);
  const [gradeDist, setGradeDist] = useState(EMPTY_GRADE_DIST);
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);

  useEffect(() => {
    if (isDemo) {
      setLoading(false);
      return;
    }

    if (!user) return;

    const fetchLiveData = async () => {
      try {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from("assignments")
          .select(ASSIGNMENT_FIELDS)
          .eq("lecturer_id", user.id);

        if (assignmentsError) throw assignmentsError;

        const assignments = assignmentsData || [];
        if (assignments.length === 0) {
          setModules([]);
          setAssessmentTrends([]);
          setGradeDist(EMPTY_GRADE_DIST);
          setAtRiskStudents([]);
          setLoading(false);
          return;
        }

        const assignmentIds = assignments.map((assignment) => assignment.id);
        const moduleSet = new Set(assignments.map((assignment) => assignment.module_code).filter(Boolean) as string[]);
        setModules(Array.from(moduleSet));

        const { data: submissionsData, error: submissionsError } = await supabase
          .from("submissions")
          .select(SUBMISSION_FIELDS)
          .in("assignment_id", assignmentIds);

        if (submissionsError) throw submissionsError;

        const submissions = submissionsData || [];
        if (submissions.length === 0) {
          setAssessmentTrends([]);
          setGradeDist(EMPTY_GRADE_DIST);
          setAtRiskStudents([]);
          setLoading(false);
          return;
        }

        const submissionIds = submissions.map((submission) => submission.id);
        let grades: Array<{ submission_id: string; ai_score: number | null; final_score: number | null }> = [];
        if (submissionIds.length > 0) {
          const { data: gradesData, error: gradesError } = await supabase
            .from("grades")
            .select(GRADE_FIELDS)
            .in("submission_id", submissionIds);

          if (gradesError) throw gradesError;
          grades = gradesData || [];
        }

        const filteredAssignments =
          moduleFilter === "all"
            ? assignments
            : assignments.filter((assignment) => assignment.module_code === moduleFilter);
        const filteredAssignmentIds = new Set(filteredAssignments.map((assignment) => assignment.id));
        const filteredSubs = submissions.filter((submission) => filteredAssignmentIds.has(submission.assignment_id));
        const filteredSubIds = new Set(filteredSubs.map((submission) => submission.id));
        const filteredGrades = grades.filter((grade) => filteredSubIds.has(grade.submission_id));

        const assignmentMap = new Map(filteredAssignments.map((assignment) => [assignment.id, assignment]));
        const gradeBySubmission = new Map(
          filteredGrades.map((grade) => [grade.submission_id, Number(grade.final_score ?? grade.ai_score)])
        );

        const perAssignment: Record<string, { scores: number[]; totalSubs: number }> = {};
        filteredSubs.forEach((submission) => {
          const assignment = assignmentMap.get(submission.assignment_id);
          if (!assignment) return;

          const key = assignment.title;
          if (!perAssignment[key]) {
            perAssignment[key] = { scores: [], totalSubs: 0 };
          }

          perAssignment[key].totalSubs++;
          const score = gradeBySubmission.get(submission.id);
          if (score != null && !Number.isNaN(score)) {
            perAssignment[key].scores.push(score);
          }
        });

        const trends = Object.entries(perAssignment).map(([name, data]) => ({
          name: name.length > 20 ? `${name.slice(0, 18)}...` : name,
          avgGrade: data.scores.length > 0 ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length) : 0,
          participation: filteredSubs.length > 0 ? Math.round((data.totalSubs / filteredSubs.length) * 100) : 0,
        }));
        setAssessmentTrends(trends);

        const allScores = filteredGrades
          .map((grade) => Number(grade.final_score ?? grade.ai_score))
          .filter((score) => !Number.isNaN(score));
        const total = allScores.length || 1;
        const dist = [
          { band: "1st (70-100%)", count: allScores.filter((score) => score >= 70).length, percentage: 0, fill: "hsl(152, 56%, 45%)" },
          { band: "2:1 (60-69%)", count: allScores.filter((score) => score >= 60 && score < 70).length, percentage: 0, fill: "hsl(205, 80%, 55%)" },
          { band: "2:2 (50-59%)", count: allScores.filter((score) => score >= 50 && score < 60).length, percentage: 0, fill: "hsl(38, 92%, 60%)" },
          { band: "3rd (40-49%)", count: allScores.filter((score) => score >= 40 && score < 50).length, percentage: 0, fill: "hsl(280, 55%, 55%)" },
          { band: "Fail (<40%)", count: allScores.filter((score) => score < 40).length, percentage: 0, fill: "hsl(0, 72%, 55%)" },
        ];
        dist.forEach((entry) => {
          entry.percentage = Math.round((entry.count / total) * 100);
        });
        setGradeDist(dist);

        const trajectories: Record<string, StudentTrajectory> = {};
        filteredSubs.forEach((submission) => {
          const key = submission.student_id || submission.student_email || submission.student_name || "unknown";
          if (!trajectories[key]) {
            trajectories[key] = {
              name: submission.student_name || submission.student_email || "Unknown Student",
              email: submission.student_email,
              studentId: key,
              scores: [],
            };
          }

          const score = gradeBySubmission.get(submission.id);
          if (score != null && !Number.isNaN(score)) {
            const assignment = assignmentMap.get(submission.assignment_id);
            trajectories[key].scores.push({
              score,
              date: submission.submitted_at,
              assignmentTitle: assignment?.title || "Assignment",
            });
          }
        });

        Object.values(trajectories).forEach((trajectory) => {
          trajectory.scores.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        });

        const risks = Object.values(trajectories)
          .map(computeRisk)
          .filter((risk): risk is AtRiskStudent => risk !== null)
          .sort((a, b) => b.riskScore - a.riskScore);

        setAtRiskStudents(risks);
      } catch (error) {
        console.error("Failed to fetch performance data:", error);
      }

      setLoading(false);
    };

    void fetchLiveData();
  }, [isDemo, user?.id, moduleFilter]);

  useEffect(() => {
    if (alertsDismissed || atRiskStudents.length === 0) return;

    const critical = atRiskStudents.filter((student) => student.riskLevel === "critical");
    const high = atRiskStudents.filter((student) => student.riskLevel === "high");

    if (critical.length > 0) {
      toast({
        variant: "destructive",
        title: `Critical At-Risk Student${critical.length > 1 ? "s" : ""}`,
        description: `${critical.map((student) => student.name).join(", ")} - immediate intervention recommended.`,
      });
    }

    if (high.length > 0) {
      toast({
        title: `${high.length} High-Risk Student${high.length > 1 ? "s" : ""} Detected`,
        description: `${high.map((student) => student.name).join(", ")} - review their trajectories.`,
      });
    }

    setAlertsDismissed(true);
  }, [atRiskStudents, alertsDismissed, toast]);

  const riskBorder = (level: AtRiskStudent["riskLevel"]) =>
    level === "critical"
      ? "border-destructive/40 bg-destructive/10"
      : level === "high"
        ? "border-destructive/20 bg-destructive/5"
        : "border-warning/30 bg-warning/5";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const noData = assessmentTrends.length === 0 && gradeDist.every((entry) => entry.count === 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {modules.map((module) => (
              <SelectItem key={module} value={module}>{module}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {atRiskStudents.length > 0 && (
          <Badge variant="destructive" className="gap-1">
            <BellRing className="h-3 w-3" />
            {atRiskStudents.length} at-risk student{atRiskStudents.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {noData ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingUp className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No graded submissions yet. Performance trends will appear once assignments are graded.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {assessmentTrends.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Average Grades Over Time</CardTitle>
                <CardDescription>Assessment performance across your assignments</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={assessmentTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                    <Legend />
                    <Line type="monotone" dataKey="avgGrade" name="Avg Grade %" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Grade Distribution</CardTitle>
                <CardDescription>Current cohort breakdown by UK classification</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={gradeDist} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis type="category" dataKey="band" tick={{ fontSize: 10 }} width={100} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} formatter={(value: number) => [`${value} students`, "Count"]} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {gradeDist.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Risk Score Summary</CardTitle>
                <CardDescription>Predictive model output - higher score = greater risk</CardDescription>
              </CardHeader>
              <CardContent>
                {atRiskStudents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                    <TrendingUp className="mb-2 h-8 w-8 text-success" />
                    <p className="text-sm">No at-risk students detected. All students are performing above threshold.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {atRiskStudents.slice(0, 5).map((student) => (
                      <div key={student.studentId} className="flex items-center justify-between gap-2">
                        <span className="flex-1 truncate text-sm">{student.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${student.riskLevel === "critical" ? "bg-destructive" : student.riskLevel === "high" ? "bg-warning" : "bg-orange-400"}`}
                              style={{ width: `${student.riskScore}%` }}
                            />
                          </div>
                          <span className="w-8 text-right font-mono text-xs">{student.riskScore}</span>
                        </div>
                      </div>
                    ))}
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Model factors: grade trajectory (linear regression), average score, volatility, predicted next score, submission frequency
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-base">Predictive At-Risk Detection</CardTitle>
              </div>
              <CardDescription>
                Students flagged by the predictive model - click for trajectory analysis and intervention recommendations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {atRiskStudents.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No at-risk students detected based on current grading data.
                </p>
              ) : (
                atRiskStudents.map((student) => {
                  const sparkData = student.sparkline.map((value, index) => ({ x: index, y: value }));
                  const isExpanded = expandedStudent === student.studentId;

                  return (
                    <div
                      key={student.studentId}
                      className={`cursor-pointer space-y-3 rounded-lg border p-4 transition-all hover:shadow-md ${riskBorder(student.riskLevel)}`}
                      onClick={() => setExpandedStudent(isExpanded ? null : student.studentId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${student.riskLevel === "critical" ? "bg-destructive/20" : "bg-destructive/10"}`}>
                            <User className="h-4 w-4 text-destructive" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{student.name}</span>
                              <Badge variant={student.riskLevel === "critical" ? "destructive" : "outline"} className="text-[10px] uppercase">
                                {student.riskLevel}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Avg: {student.avgGrade}% - Risk Score: {student.riskScore}/100 - Predicted Next: {student.predictedNext}%
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-[30px] w-[80px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={sparkData}>
                                <Line type="monotone" dataKey="y" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-destructive">{student.lastGrade}%</span>
                            {student.trend === "declining" && <TrendingDown className="ml-1 inline-block h-4 w-4 text-destructive" />}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {student.flags.map((flag, index) => (
                          <Badge key={index} variant="outline" className="border-destructive/30 text-xs text-destructive">{flag}</Badge>
                        ))}
                      </div>
                      {isExpanded && (
                        <div className="mt-2 animate-fade-in space-y-2 rounded-lg border bg-card p-3">
                          <div className="flex items-start gap-2">
                            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <div>
                              <p className="mb-1 text-xs font-medium text-primary">Intervention Recommendation</p>
                              <p className="text-sm text-muted-foreground">{student.recommendation}</p>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="rounded bg-muted p-2">
                              <p className="font-medium">{student.avgGrade}%</p>
                              <p className="text-muted-foreground">Average</p>
                            </div>
                            <div className="rounded bg-muted p-2">
                              <p className="font-medium">{student.lastGrade}%</p>
                              <p className="text-muted-foreground">Last Grade</p>
                            </div>
                            <div className="rounded bg-muted p-2">
                              <p className="font-medium text-destructive">{student.predictedNext}%</p>
                              <p className="text-muted-foreground">Predicted</p>
                            </div>
                          </div>
                          {student.email && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2 text-xs"
                              onClick={(event) => {
                                event.stopPropagation();
                                window.location.href = `mailto:${student.email}?subject=Academic Support - Performance Check-in&body=Dear ${student.name},%0A%0AI would like to schedule a meeting to discuss your academic progress and explore support options available to you.%0A%0ABest regards`;
                              }}
                            >
                              <Bell className="mr-1 h-3 w-3" /> Contact Student
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default PerformanceTrends;
