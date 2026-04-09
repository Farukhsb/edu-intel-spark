import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BookOpen, CheckCircle2, Circle, Target, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PlanModule {
  module: string;
  currentGrade: number;
  targetGrade: number;
  tasks: { task: string; done: boolean }[];
}

interface Resource {
  title: string;
  type: string;
  duration: string;
  relevance: number;
}

const DEMO_PLAN: PlanModule[] = [
  { module: "CS301 - Data Structures", currentGrade: 61, targetGrade: 70, tasks: [
    { task: "Review recursion base case patterns", done: true },
    { task: "Practice 5 tree traversal problems", done: true },
    { task: "Complete Big-O analysis worksheet", done: false },
    { task: "Write test cases for edge scenarios", done: false },
  ]},
  { module: "CS205 - Algorithms", currentGrade: 66, targetGrade: 70, tasks: [
    { task: "Study dynamic programming fundamentals", done: true },
    { task: "Solve 3 graph algorithm problems", done: false },
    { task: "Review sorting algorithm comparisons", done: false },
  ]},
];

const DEMO_RESOURCES: Resource[] = [
  { title: "Recursion Deep Dive", type: "Video", duration: "25 min", relevance: 95 },
  { title: "Big-O Cheat Sheet", type: "Guide", duration: "10 min", relevance: 88 },
  { title: "Tree Traversal Practice Set", type: "Exercises", duration: "45 min", relevance: 82 },
  { title: "Writing Better Test Cases", type: "Article", duration: "15 min", relevance: 76 },
];

const ImprovementPlan = () => {
  const { user, isDemo } = useAuth();
  const [plan, setPlan] = useState<PlanModule[]>(isDemo ? DEMO_PLAN : []);
  const [resources, setResources] = useState<Resource[]>(isDemo ? DEMO_RESOURCES : []);
  const [loading, setLoading] = useState(!isDemo);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (isDemo || !user) return;
    fetchPlan();
  }, [user, isDemo]);

  const fetchPlan = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: subs } = await supabase
        .from("submissions")
        .select("*")
        .eq("student_id", user.id);

      if (!subs || subs.length === 0) { setLoading(false); return; }

      const subIds = subs.map(s => s.id);
      const assignmentIds = [...new Set(subs.map(s => s.assignment_id))];

      const [{ data: grades }, { data: assignments }] = await Promise.all([
        supabase.from("grades").select("*").in("submission_id", subIds),
        supabase.from("assignments").select("*").in("id", assignmentIds),
      ]);

      const assignmentMap: Record<string, any> = {};
      (assignments || []).forEach(a => { assignmentMap[a.id] = a; });

      const gradeMap: Record<string, any> = {};
      (grades || []).forEach(g => { gradeMap[g.submission_id] = g; });

      const moduleScores: Record<string, { scores: number[]; maxScores: number[] }> = {};
      subs.forEach(s => {
        const a = assignmentMap[s.assignment_id];
        const g = gradeMap[s.id];
        if (!a || !g) return;
        const score = g.final_score ?? g.ai_score;
        if (score == null) return;
        const key = a.module_code || a.title;
        if (!moduleScores[key]) moduleScores[key] = { scores: [], maxScores: [] };
        moduleScores[key].scores.push(score);
        moduleScores[key].maxScores.push(a.max_score);
      });

      const livePlan: PlanModule[] = Object.entries(moduleScores).map(([mod, data]) => {
        const avg = Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length);
        return {
          module: mod,
          currentGrade: avg,
          targetGrade: Math.max(avg + 10, 70),
          tasks: [
            { task: `Review weak areas in ${mod}`, done: false },
            { task: `Complete practice problems`, done: false },
            { task: `Seek feedback on last submission`, done: false },
          ],
        };
      });

      if (livePlan.length > 0) setPlan(livePlan);
    } catch (err) {
      console.error("Failed to fetch plan:", err);
    }
    setLoading(false);
  };

  const generateAIRecommendations = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("explain-grade", {
        body: {
          messages: [{ role: "user", content: `Based on these modules and grades, give me 4 specific improvement resources:\n${plan.map(p => `${p.module}: ${p.currentGrade}% (target: ${p.targetGrade}%)`).join("\n")}` }],
          gradeContext: { plan },
        },
      });
      if (error) throw error;
      toast.success("AI recommendations updated");
    } catch {
      toast.error("Failed to get AI recommendations. Using defaults.");
    }
    setGenerating(false);
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="flex items-center gap-2 p-3">
            <Badge variant="outline" className="border-warning text-warning">Demo</Badge>
            <span className="text-sm text-muted-foreground">Viewing demo improvement plan data</span>
          </CardContent>
        </Card>
      )}

      {plan.map((p, i) => {
        const completed = p.tasks.filter((t) => t.done).length;
        const progress = (completed / p.tasks.length) * 100;
        return (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{p.module}</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{p.currentGrade}%</span>
                  <Target className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-bold text-primary">{p.targetGrade}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={progress} className="h-2" />
                <span className="text-xs text-muted-foreground">{completed}/{p.tasks.length}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {p.tasks.map((t, j) => (
                <div key={j} className="flex items-center gap-3 text-sm">
                  {t.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className={t.done ? "text-muted-foreground line-through" : ""}>{t.task}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Recommended Resources</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={generateAIRecommendations} disabled={generating}>
              {generating ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
              AI Refresh
            </Button>
          </div>
          <CardDescription>AI-curated materials based on your weak areas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {resources.map((r, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.type} · {r.duration}</p>
              </div>
              <Badge variant="outline">{r.relevance}% match</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ImprovementPlan;
