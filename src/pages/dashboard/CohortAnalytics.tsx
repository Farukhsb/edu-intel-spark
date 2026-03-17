import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle, Lightbulb, Target } from "lucide-react";

const learningOutcomes = [
  { outcome: "LO1: Understand data structures", achievement: 78, target: 70, status: "met" },
  { outcome: "LO2: Apply algorithmic thinking", achievement: 52, target: 70, status: "at-risk" },
  { outcome: "LO3: Implement sorting algorithms", achievement: 71, target: 70, status: "met" },
  { outcome: "LO4: Analyse complexity", achievement: 45, target: 70, status: "below" },
  { outcome: "LO5: Design recursive solutions", achievement: 38, target: 70, status: "below" },
];

const recommendations = [
  {
    topic: "Recursion & Base Cases",
    reason: "67% of students failing to identify correct base cases",
    suggestion: "Add a dedicated workshop on tree recursion patterns with visual step-through",
    priority: "critical",
  },
  {
    topic: "Big-O Notation",
    reason: "Students confusing amortised vs worst-case analysis",
    suggestion: "Introduce comparison tables and real-world benchmarking exercises",
    priority: "high",
  },
  {
    topic: "Dynamic Programming",
    reason: "Low engagement with practice problems",
    suggestion: "Gamify DP exercises with progressive difficulty levels",
    priority: "medium",
  },
];

const moduleComparison = [
  { module: "CS301 - Data Structures", avgGrade: 62, submissions: 156, passRate: 74 },
  { module: "CS205 - Algorithms", avgGrade: 58, submissions: 134, passRate: 68 },
  { module: "CS102 - Intro to Prog", avgGrade: 71, submissions: 210, passRate: 89 },
  { module: "CS401 - AI & ML", avgGrade: 66, submissions: 98, passRate: 78 },
];

const CohortAnalytics = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <Tabs defaultValue="outcomes">
        <TabsList>
          <TabsTrigger value="outcomes">Learning Outcomes</TabsTrigger>
          <TabsTrigger value="modules">Module Comparison</TabsTrigger>
          <TabsTrigger value="recommendations">AI Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="outcomes" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Learning Outcome Achievement</CardTitle>
              <CardDescription>CS301 — Data Structures & Algorithms (2024/25)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {learningOutcomes.map((lo, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{lo.outcome}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{lo.achievement}%</span>
                      {lo.status === "met" && (
                        <CheckCircle className="h-4 w-4 text-success" />
                      )}
                      {lo.status === "at-risk" && (
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      )}
                      {lo.status === "below" && (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  </div>
                  <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                        lo.status === "met"
                          ? "bg-success"
                          : lo.status === "at-risk"
                          ? "bg-warning"
                          : "bg-destructive"
                      }`}
                      style={{ width: `${lo.achievement}%` }}
                    />
                    <div
                      className="absolute inset-y-0 w-0.5 bg-foreground/40"
                      style={{ left: `${lo.target}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Target: {lo.target}%</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {moduleComparison.map((mod, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{mod.module}</p>
                      <p className="mt-1 text-3xl font-bold font-display">{mod.avgGrade}%</p>
                      <p className="text-xs text-muted-foreground">Average Grade</p>
                    </div>
                    <Badge variant={mod.passRate >= 80 ? "default" : mod.passRate >= 70 ? "secondary" : "destructive"}>
                      {mod.passRate}% pass
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{mod.submissions} submissions</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="mt-4 space-y-4">
          {recommendations.map((rec, i) => (
            <Card key={i} className="border-l-4 border-l-primary">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm">{rec.topic}</h3>
                      <Badge
                        variant={
                          rec.priority === "critical"
                            ? "destructive"
                            : rec.priority === "high"
                            ? "secondary"
                            : "outline"
                        }
                        className="text-xs"
                      >
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.reason}</p>
                    <div className="flex items-center gap-1.5 pt-1 text-sm font-medium text-primary">
                      <ArrowRight className="h-3.5 w-3.5" />
                      {rec.suggestion}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CohortAnalytics;
