import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Lightbulb, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ASSIGNMENT_FIELDS = "id, title, module_code";
const SUBMISSION_FIELDS = "id, assignment_id";
const GRADE_FIELDS = "submission_id, ai_score, final_score";

interface ModuleData {
  id: string;
  code: string;
  title: string;
  avgGrade: number;
  submissions: number;
  passRate: number;
}

const DEMO_RECS = [
  { topic: "Recursion & Base Cases", reason: "67% of students failing to identify correct base cases", suggestion: "Add a dedicated workshop on tree recursion patterns", priority: "critical" },
  { topic: "Big-O Notation", reason: "Students confusing amortised vs worst-case analysis", suggestion: "Introduce comparison tables and benchmarking exercises", priority: "high" },
  { topic: "Dynamic Programming", reason: "Low engagement with practice problems", suggestion: "Gamify DP exercises with progressive difficulty levels", priority: "medium" },
];

const EMPTY_GRADE_DIST = [
  { band: "1st (70+)", count: 0, fill: "hsl(152, 56%, 45%)" },
  { band: "2:1 (60-69)", count: 0, fill: "hsl(205, 80%, 55%)" },
  { band: "2:2 (50-59)", count: 0, fill: "hsl(38, 92%, 60%)" },
  { band: "3rd (40-49)", count: 0, fill: "hsl(280, 55%, 55%)" },
  { band: "Fail (<40)", count: 0, fill: "hsl(0, 72%, 55%)" },
];

const CohortAnalytics = () => {
  const { isDemo, user } = useAuth();
  const [moduleFilter, setModuleFilter] = useState("all");
  const [gradeDistChart, setGradeDistChart] = useState(EMPTY_GRADE_DIST);
  const [recommendations, setRecommendations] = useState(isDemo ? DEMO_RECS : []);
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [loading, setLoading] = useState(!isDemo);

  useEffect(() => {
    if (isDemo || !user) return;

    const fetchData = async () => {
      try {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from("assignments")
          .select(ASSIGNMENT_FIELDS)
          .eq("lecturer_id", user.id);

        if (assignmentsError) throw assignmentsError;

        const assignments = assignmentsData || [];
        const assignmentIds = assignments.map((assignment) => assignment.id);

        if (assignmentIds.length === 0) {
          setModules([]);
          setGradeDistChart(EMPTY_GRADE_DIST);
          setLoading(false);
          return;
        }

        const { data: submissionsData, error: submissionsError } = await supabase
          .from("submissions")
          .select(SUBMISSION_FIELDS)
          .in("assignment_id", assignmentIds);

        if (submissionsError) throw submissionsError;

        const submissions = submissionsData || [];
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

        const gradeBySubmission: Record<string, number> = {};
        grades.forEach((grade) => {
          const score = grade.final_score ?? grade.ai_score;
          if (score != null) {
            gradeBySubmission[grade.submission_id] = score;
          }
        });

        const submissionsByAssignment: Record<string, string[]> = {};
        submissions.forEach((submission) => {
          if (!submissionsByAssignment[submission.assignment_id]) {
            submissionsByAssignment[submission.assignment_id] = [];
          }
          submissionsByAssignment[submission.assignment_id].push(submission.id);
        });

        const allScores = Object.values(gradeBySubmission);
        if (allScores.length > 0) {
          setGradeDistChart([
            { band: "1st (70+)", count: allScores.filter((score) => score >= 70).length, fill: "hsl(152, 56%, 45%)" },
            { band: "2:1 (60-69)", count: allScores.filter((score) => score >= 60 && score < 70).length, fill: "hsl(205, 80%, 55%)" },
            { band: "2:2 (50-59)", count: allScores.filter((score) => score >= 50 && score < 60).length, fill: "hsl(38, 92%, 60%)" },
            { band: "3rd (40-49)", count: allScores.filter((score) => score >= 40 && score < 50).length, fill: "hsl(280, 55%, 55%)" },
            { band: "Fail (<40)", count: allScores.filter((score) => score < 40).length, fill: "hsl(0, 72%, 55%)" },
          ]);
        } else {
          setGradeDistChart(EMPTY_GRADE_DIST);
        }

        const moduleData: ModuleData[] = assignments.map((assignment) => {
          const subIds = submissionsByAssignment[assignment.id] || [];
          const scores = subIds
            .map((submissionId) => gradeBySubmission[submissionId])
            .filter((score) => score != null) as number[];
          const avgGrade = scores.length > 0 ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : 0;
          const passRate = scores.length > 0 ? Math.round((scores.filter((score) => score >= 40).length / scores.length) * 100) : 0;

          return {
            id: assignment.id,
            code: assignment.module_code || "-",
            title: assignment.title,
            avgGrade,
            submissions: subIds.length,
            passRate,
          };
        });

        setModules(moduleData);
      } catch (error) {
        console.error("Failed to fetch cohort data:", error);
      }

      setLoading(false);
    };

    void fetchData();
  }, [isDemo, user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filteredModules = moduleFilter === "all" ? modules : modules.filter((module) => module.id === moduleFilter);

  return (
    <div className="space-y-6 animate-fade-in">
      {modules.length > 0 && (
        <div className="flex items-center gap-4">
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Filter by assignment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignments</SelectItem>
              {modules.map((module) => (
                <SelectItem key={module.id} value={module.id}>
                  {module.code !== "-" ? `${module.code} - ` : ""}
                  {module.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Tabs defaultValue="distribution">
        <TabsList>
          <TabsTrigger value="distribution">Grade Distribution</TabsTrigger>
          <TabsTrigger value="modules">Assignment Comparison</TabsTrigger>
          <TabsTrigger value="recommendations">AI Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="distribution" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Grade Distribution</CardTitle>
              <CardDescription>Cohort classification breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {gradeDistChart.every((item) => item.count === 0) ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No graded submissions yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={gradeDistChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="band" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {gradeDistChart.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="mt-4">
          {filteredModules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">No assignments found</CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredModules.map((module) => (
                <Card key={module.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">
                          {module.code !== "-" ? `${module.code} - ` : ""}
                          {module.title}
                        </p>
                        <p className="mt-1 text-3xl font-bold font-display">{module.avgGrade > 0 ? `${module.avgGrade}%` : "-"}</p>
                        <p className="text-xs text-muted-foreground">Average Grade</p>
                      </div>
                      {module.submissions > 0 && (
                        <Badge variant={module.passRate >= 80 ? "default" : module.passRate >= 70 ? "secondary" : "destructive"}>
                          {module.passRate}% pass
                        </Badge>
                      )}
                    </div>
                    <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{module.submissions} submissions</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="mt-4 space-y-4">
          {recommendations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">AI recommendations will appear here once enough grading data is available.</p>
              </CardContent>
            </Card>
          ) : (
            recommendations.map((recommendation, index) => (
              <Card key={index} className="border-l-4 border-l-primary">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm">{recommendation.topic}</h3>
                        <Badge
                          variant={
                            recommendation.priority === "critical"
                              ? "destructive"
                              : recommendation.priority === "high"
                                ? "secondary"
                                : "outline"
                          }
                          className="text-xs"
                        >
                          {recommendation.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{recommendation.reason}</p>
                      <div className="flex items-center gap-1.5 pt-1 text-sm font-medium text-primary">
                        <ArrowRight className="h-3.5 w-3.5" />
                        {recommendation.suggestion}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CohortAnalytics;
