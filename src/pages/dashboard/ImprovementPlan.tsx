import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BookOpen, CheckCircle2, Circle, Loader2, RefreshCw, Target, TrendingDown, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ImprovementTask {
  id: string;
  task: string;
  area: string;
  done: boolean;
}

interface PlanModule {
  module: string;
  currentGrade: number;
  targetGrade: number;
  trend: "up" | "down" | "steady";
  trendDelta: number;
  strengths: string[];
  weaknesses: string[];
  nextSubmissionFocus: string[];
  tasks: ImprovementTask[];
  chart: Array<{ assessment: string; score: number }>;
}

interface Resource {
  title: string;
  type: string;
  duration: string;
  relevance: number;
  reason: string;
}

const DEMO_PLAN: PlanModule[] = [
  {
    module: "CS301 - Data Structures",
    currentGrade: 61,
    targetGrade: 70,
    trend: "up",
    trendDelta: 9,
    strengths: ["Code Quality", "Tree Traversal Accuracy"],
    weaknesses: ["Complexity Analysis", "Test Coverage"],
    nextSubmissionFocus: [
      "Show time and space complexity explicitly for each major function.",
      "Add edge-case tests for empty, single-node, and unbalanced trees.",
    ],
    tasks: [
      { id: "demo-ds-1", task: "Complete Big-O analysis worksheet", area: "Complexity Analysis", done: false },
      { id: "demo-ds-2", task: "Write 5 extra edge-case tests", area: "Test Coverage", done: false },
      { id: "demo-ds-3", task: "Review lecturer feedback before next lab", area: "Feedback", done: true },
    ],
    chart: [
      { assessment: "A1", score: 54 },
      { assessment: "Quiz", score: 58 },
      { assessment: "Lab", score: 61 },
      { assessment: "A2", score: 63 },
    ],
  },
  {
    module: "CS205 - Algorithms",
    currentGrade: 66,
    targetGrade: 72,
    trend: "down",
    trendDelta: -6,
    strengths: ["Problem Framing", "Presentation"],
    weaknesses: ["Efficiency", "Dynamic Programming Structure"],
    nextSubmissionFocus: [
      "State the recurrence relation before coding the solution.",
      "Compare brute-force and optimized complexity in the write-up.",
    ],
    tasks: [
      { id: "demo-algo-1", task: "Solve 3 dynamic programming exercises", area: "Dynamic Programming Structure", done: false },
      { id: "demo-algo-2", task: "Create a complexity comparison sheet", area: "Efficiency", done: true },
    ],
    chart: [
      { assessment: "A1", score: 71 },
      { assessment: "Midterm", score: 68 },
      { assessment: "A2", score: 66 },
      { assessment: "Lab", score: 65 },
    ],
  },
];

const DEMO_RESOURCES: Resource[] = [
  {
    title: "Big-O Reasoning Worksheet",
    type: "Guide",
    duration: "15 min",
    relevance: 94,
    reason: "Targets repeated weakness in complexity analysis.",
  },
  {
    title: "Dynamic Programming Pattern Drills",
    type: "Exercises",
    duration: "40 min",
    relevance: 90,
    reason: "Improves structure before the next algorithm submission.",
  },
  {
    title: "Testing Edge Cases in Python",
    type: "Article",
    duration: "12 min",
    relevance: 84,
    reason: "Helps strengthen low-scoring test coverage work.",
  },
];

const ImprovementPlan = () => {
  const { user, isDemo } = useAuth();
  const [plan, setPlan] = useState<PlanModule[]>(isDemo ? DEMO_PLAN : []);
  const [resources, setResources] = useState<Resource[]>(isDemo ? DEMO_RESOURCES : []);
  const [loading, setLoading] = useState(!isDemo);
  const [generating, setGenerating] = useState(false);
  const latestPlanRef = useRef<PlanModule[]>(isDemo ? DEMO_PLAN : []);

  useEffect(() => {
    if (isDemo || !user) return;
    void fetchPlan();
  }, [user, isDemo]);

  const fetchPlan = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: submissions }, { data: progressRows }] = await Promise.all([
        supabase
          .from("submissions")
          .select("*")
          .eq("student_id", user.id)
          .order("submitted_at", { ascending: true }),
        supabase
          .from("improvement_plan_progress")
          .select("task_key, completed")
          .eq("student_id", user.id),
      ]);

      if (!submissions || submissions.length === 0) {
        setPlan([]);
        setResources([]);
        latestPlanRef.current = [];
        setLoading(false);
        return;
      }

      const submissionIds = submissions.map((submission) => submission.id);
      const assignmentIds = [...new Set(submissions.map((submission) => submission.assignment_id))];

      const [{ data: grades }, { data: assignments }] = await Promise.all([
        supabase.from("grades").select("*").in("submission_id", submissionIds),
        supabase.from("assignments").select("*").in("id", assignmentIds),
      ]);

      const assignmentMap: Record<string, any> = {};
      (assignments || []).forEach((assignment) => {
        assignmentMap[assignment.id] = assignment;
      });

      const gradeMap: Record<string, any> = {};
      (grades || []).forEach((grade) => {
        gradeMap[grade.submission_id] = grade;
      });

      const taskOverrides = Object.fromEntries(
        (progressRows || []).map((row) => [row.task_key, row.completed])
      ) as Record<string, boolean>;
      const moduleBuckets: Record<
        string,
        {
          scores: number[];
          chart: Array<{ assessment: string; score: number }>;
          criterionScores: Record<string, number[]>;
        }
      > = {};

      submissions.forEach((submission) => {
        const assignment = assignmentMap[submission.assignment_id];
        const grade = gradeMap[submission.id];
        const score = grade?.final_score ?? grade?.ai_score;
        if (!assignment || score == null) return;

        const moduleKey = [assignment.module_code, assignment.title].filter(Boolean).join(" - ") || assignment.title;
        if (!moduleBuckets[moduleKey]) {
          moduleBuckets[moduleKey] = {
            scores: [],
            chart: [],
            criterionScores: {},
          };
        }

        moduleBuckets[moduleKey].scores.push(score);
        moduleBuckets[moduleKey].chart.push({
          assessment: assignment.title.length > 18 ? `${assignment.title.slice(0, 16)}...` : assignment.title,
          score,
        });

        const breakdown = Array.isArray(grade?.ai_breakdown) ? grade.ai_breakdown : [];
        breakdown.forEach((item: any) => {
          const criterion = item.criterion || item.name || "Unknown";
          const maxScore = item.max_score ?? item.maxScore ?? 10;
          const percent = maxScore > 0 ? Math.round(((item.score ?? 0) / maxScore) * 100) : 0;
          if (!moduleBuckets[moduleKey].criterionScores[criterion]) {
            moduleBuckets[moduleKey].criterionScores[criterion] = [];
          }
          moduleBuckets[moduleKey].criterionScores[criterion].push(percent);
        });
      });

      const nextPlan: PlanModule[] = Object.entries(moduleBuckets).map(([module, bucket]) => {
        const currentGrade = Math.round(bucket.scores.reduce((sum, score) => sum + score, 0) / bucket.scores.length);
        const firstScore = bucket.scores[0] ?? currentGrade;
        const lastScore = bucket.scores[bucket.scores.length - 1] ?? currentGrade;
        const trendDelta = lastScore - firstScore;
        const trend: PlanModule["trend"] = trendDelta > 3 ? "up" : trendDelta < -3 ? "down" : "steady";

        const criterionAverages = Object.entries(bucket.criterionScores).map(([criterion, values]) => ({
          criterion,
          average: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
        }));

        const strengths = criterionAverages
          .filter((criterion) => criterion.average >= 70)
          .sort((left, right) => right.average - left.average)
          .slice(0, 2)
          .map((criterion) => criterion.criterion);

        const weaknesses = criterionAverages
          .filter((criterion) => criterion.average < 70)
          .sort((left, right) => left.average - right.average)
          .slice(0, 3)
          .map((criterion) => criterion.criterion);

        const nextSubmissionFocus =
          weaknesses.length > 0
            ? weaknesses.map((weakness) => `Improve ${weakness.toLowerCase()} before the next submission.`)
            : ["Maintain your strongest criteria and keep your explanation clear."];

        const tasks = (
          weaknesses.length > 0
            ? weaknesses.map((weakness, index) => ({
                id: `${module}-${weakness}-${index}`.replace(/\s+/g, "-").toLowerCase(),
                task:
                  index === 0
                    ? `Review lecturer feedback for ${weakness}`
                    : index === 1
                      ? `Complete a focused practice task on ${weakness}`
                      : `Prepare a checklist for ${weakness} before the next submission`,
                area: weakness,
                done: false,
              }))
            : [
                {
                  id: `${module}-maintain-strength`.replace(/\s+/g, "-").toLowerCase(),
                  task: "Keep using the approaches that produced your strongest scores",
                  area: "Consistency",
                  done: false,
                },
              ]
        ).map((task) => ({
          ...task,
          done: taskOverrides[task.id] ?? task.done,
        }));

        return {
          module,
          currentGrade,
          targetGrade: Math.max(currentGrade + 8, 70),
          trend,
          trendDelta,
          strengths,
          weaknesses,
          nextSubmissionFocus,
          tasks,
          chart: bucket.chart,
        };
      });

      nextPlan.sort((left, right) => left.currentGrade - right.currentGrade);
      setPlan(nextPlan);
      latestPlanRef.current = nextPlan;

      const nextResources: Resource[] = nextPlan
        .flatMap((module) =>
          module.weaknesses.slice(0, 2).map((weakness, index) => ({
            title:
              index === 0
                ? `${weakness} revision pack`
                : `${weakness} practice set`,
            type: index === 0 ? "Guide" : "Exercises",
            duration: index === 0 ? "15 min" : "30 min",
            relevance: Math.max(75, 95 - index * 8),
            reason: `${weakness} is currently one of your lowest-scoring criteria in ${module.module}.`,
          }))
        )
        .slice(0, 6);

      setResources(nextResources);
    } catch (error) {
      console.error("Failed to fetch improvement plan:", error);
      toast.error("Could not load your improvement plan.");
    }
    setLoading(false);
  };

  useEffect(() => {
    latestPlanRef.current = plan;
  }, [plan]);

  const toggleTask = async (moduleName: string, taskId: string) => {
    const previousPlan = latestPlanRef.current;
    let nextCompleted = false;
    const nextPlan = previousPlan.map((module) =>
      module.module === moduleName
        ? {
            ...module,
            tasks: module.tasks.map((task) => {
              if (task.id !== taskId) return task;
              nextCompleted = !task.done;
              return { ...task, done: nextCompleted };
            }),
          }
        : module
    );

    setPlan(nextPlan);
    latestPlanRef.current = nextPlan;

    if (isDemo || !user) {
      return;
    }

    const { error } = await supabase.from("improvement_plan_progress").upsert(
      {
        student_id: user.id,
        task_key: taskId,
        completed: nextCompleted,
        completed_at: nextCompleted ? new Date().toISOString() : null,
      },
      { onConflict: "student_id,task_key" }
    );

    if (error) {
      console.error("Failed to save improvement task progress:", error);
      setPlan(previousPlan);
      latestPlanRef.current = previousPlan;
      toast.error("Could not save task progress.");
    }
  };

  const generateAIRecommendations = async () => {
    if (plan.length === 0) return;
    setGenerating(true);
    try {
      await supabase.functions.invoke("explain-grade", {
        body: {
          messages: [
            {
              role: "user",
              content: `Give concise next-step study actions for these modules:\n${plan
                .map(
                  (module) =>
                    `${module.module}: current ${module.currentGrade}%, target ${module.targetGrade}%, weaknesses: ${module.weaknesses.join(", ")}`
                )
                .join("\n")}`,
            },
          ],
          gradeContext: { plan },
        },
      });

      setResources((current) =>
        current.map((resource, index) => ({
          ...resource,
          relevance: Math.max(70, resource.relevance - index + 2),
        }))
      );
      toast.success("Recommendations refreshed");
    } catch {
      toast.error("Failed to refresh recommendations. Existing plan kept.");
    }
    setGenerating(false);
  };

  const overallTasks = useMemo(() => {
    const allTasks = plan.flatMap((module) => module.tasks);
    const completed = allTasks.filter((task) => task.done).length;
    return {
      total: allTasks.length,
      completed,
      progress: allTasks.length > 0 ? Math.round((completed / allTasks.length) * 100) : 0,
    };
  }, [plan]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (plan.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium">No improvement plan yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Submit and receive graded work to unlock a personalised improvement journey.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="flex items-center gap-2 p-3">
            <Badge variant="outline" className="border-warning text-warning">
              Demo
            </Badge>
            <span className="text-sm text-muted-foreground">Viewing demo improvement plan data</span>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium">Your next-step study plan</p>
            <p className="text-xs text-muted-foreground">
              Focus on the lowest-scoring criteria first, then track completion before the next submission.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-bold font-display">{overallTasks.progress}%</p>
              <p className="text-xs text-muted-foreground">task completion</p>
            </div>
            <Progress value={overallTasks.progress} className="h-2 w-32" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Modules tracked</p>
            <p className="mt-2 text-2xl font-semibold">{plan.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Completed tasks</p>
            <p className="mt-2 text-2xl font-semibold">{overallTasks.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tasks still open</p>
            <p className="mt-2 text-2xl font-semibold">{overallTasks.total - overallTasks.completed}</p>
          </CardContent>
        </Card>
      </div>

      {plan.map((module) => {
        const completed = module.tasks.filter((task) => task.done).length;
        const progress = module.tasks.length > 0 ? (completed / module.tasks.length) * 100 : 0;

        return (
          <Card key={module.module}>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base">{module.module}</CardTitle>
                  <CardDescription>
                    Current {module.currentGrade}% • Target {module.targetGrade}% •{" "}
                    {module.trend === "up" ? "improving" : module.trend === "down" ? "declining" : "steady"} trend
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-sm">
                    {module.trend === "up" ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : module.trend === "down" ? (
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    ) : (
                      <Target className="h-4 w-4 text-primary" />
                    )}
                    <span className="font-medium">
                      {module.trendDelta > 0 ? `+${module.trendDelta}` : module.trendDelta} pts
                    </span>
                  </div>
                  <div className="w-32">
                    <Progress value={progress} className="h-2" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {completed}/{module.tasks.length}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Strengths</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {module.strengths.length > 0 ? (
                          module.strengths.map((strength) => (
                            <Badge key={strength} variant="default">
                              {strength}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">Still building enough evidence.</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Weaknesses</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {module.weaknesses.length > 0 ? (
                          module.weaknesses.map((weakness) => (
                            <Badge key={weakness} variant="outline">
                              {weakness}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No major weak area detected.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <p className="text-sm font-medium">What to improve before your next submission</p>
                    <div className="mt-3 space-y-2">
                      {module.nextSubmissionFocus.map((focus) => (
                        <div key={focus} className="flex items-start gap-2 text-sm">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          <span>{focus}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">Grade trend over time</p>
                  <div className="mt-4 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={module.chart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="assessment" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke={module.trend === "down" ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
                          strokeWidth={2.5}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium">Track your improvement tasks</p>
                <div className="mt-4 space-y-3">
                  {module.tasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-3">
                      <Checkbox checked={task.done} onCheckedChange={() => toggleTask(module.module, task.id)} />
                      <div className="space-y-1">
                        <p className={`text-sm ${task.done ? "text-muted-foreground line-through" : ""}`}>
                          {task.task}
                        </p>
                        <p className="text-xs text-muted-foreground">{task.area}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Recommended Resources</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={generateAIRecommendations} disabled={generating}>
              {generating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
              Refresh
            </Button>
          </div>
          <CardDescription>Resources matched to your weakest criteria and next submission priorities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {resources.map((resource) => (
            <div key={`${resource.title}-${resource.reason}`} className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">{resource.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {resource.type} • {resource.duration}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{resource.reason}</p>
              </div>
              <Badge variant="outline">{resource.relevance}% match</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ImprovementPlan;
