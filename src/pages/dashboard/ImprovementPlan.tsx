import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, CheckCircle2, Circle, Target } from "lucide-react";

const plan = [
  {
    module: "CS301 - Data Structures",
    currentGrade: 61,
    targetGrade: 70,
    tasks: [
      { task: "Review recursion base case patterns", done: true },
      { task: "Practice 5 tree traversal problems", done: true },
      { task: "Complete Big-O analysis worksheet", done: false },
      { task: "Write test cases for edge scenarios", done: false },
    ],
  },
  {
    module: "CS205 - Algorithms",
    currentGrade: 66,
    targetGrade: 70,
    tasks: [
      { task: "Study dynamic programming fundamentals", done: true },
      { task: "Solve 3 graph algorithm problems", done: false },
      { task: "Review sorting algorithm comparisons", done: false },
    ],
  },
];

const resources = [
  { title: "Recursion Deep Dive", type: "Video", duration: "25 min", relevance: 95 },
  { title: "Big-O Cheat Sheet", type: "Guide", duration: "10 min", relevance: 88 },
  { title: "Tree Traversal Practice Set", type: "Exercises", duration: "45 min", relevance: 82 },
  { title: "Writing Better Test Cases", type: "Article", duration: "15 min", relevance: 76 },
];

const ImprovementPlan = () => {
  return (
    <div className="space-y-6 animate-fade-in">
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
                  {t.done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={t.done ? "text-muted-foreground line-through" : ""}>{t.task}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* Recommended Resources */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Recommended Resources</CardTitle>
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
