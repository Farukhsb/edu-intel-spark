import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Lightbulb, Target, TrendingDown, TrendingUp, User } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const scenarioStudents: Record<string, {
  name: string;
  scenario: string;
  avgGrade: number;
  trend: "improving" | "declining" | "at-risk";
  modules: string[];
  grades: Array<{ assessment: string; grade: number }>;
  learningOutcomes: Array<{ lo: string; score: number; target: number }>;
  recommendations: string[];
}> = {
  "alice-chen": {
    name: "Alice Chen",
    scenario: "Showing Improvement",
    avgGrade: 74,
    trend: "improving",
    modules: ["CS301", "CS102"],
    grades: [
      { assessment: "Assignment 1", grade: 60 },
      { assessment: "Midterm", grade: 65 },
      { assessment: "Assignment 2", grade: 72 },
      { assessment: "Lab Report", grade: 78 },
      { assessment: "Assignment 3", grade: 80 },
    ],
    learningOutcomes: [
      { lo: "LO1: Data Structures", score: 82, target: 70 },
      { lo: "LO2: Algorithmic Thinking", score: 75, target: 70 },
      { lo: "LO3: Sorting Algorithms", score: 70, target: 70 },
      { lo: "LO4: Complexity Analysis", score: 65, target: 70 },
    ],
    recommendations: [
      "Continue current study approach — showing consistent improvement",
      "Focus on complexity analysis to meet target",
      "Consider peer tutoring others in data structures",
    ],
  },
  "david-lee": {
    name: "David Lee",
    scenario: "Declining Performance",
    avgGrade: 38,
    trend: "declining",
    modules: ["CS301", "CS205"],
    grades: [
      { assessment: "Assignment 1", grade: 65 },
      { assessment: "Midterm", grade: 58 },
      { assessment: "Assignment 2", grade: 45 },
      { assessment: "Lab Report", grade: 38 },
      { assessment: "Assignment 3", grade: 32 },
    ],
    learningOutcomes: [
      { lo: "LO1: Data Structures", score: 42, target: 70 },
      { lo: "LO2: Algorithmic Thinking", score: 35, target: 70 },
      { lo: "LO3: Sorting Algorithms", score: 40, target: 70 },
      { lo: "LO4: Complexity Analysis", score: 28, target: 70 },
    ],
    recommendations: [
      "Urgent: Schedule tutoring sessions for core concepts",
      "Consider reducing workload or seeking academic support",
      "Review fundamentals of data structures before advancing",
      "Assign peer mentor for weekly check-ins",
    ],
  },
  "fatima-alrashid": {
    name: "Fatima Al-Rashid",
    scenario: "At-Risk (Sudden Decline)",
    avgGrade: 51,
    trend: "at-risk",
    modules: ["CS301", "CS401"],
    grades: [
      { assessment: "Assignment 1", grade: 68 },
      { assessment: "Midterm", grade: 60 },
      { assessment: "Assignment 2", grade: 55 },
      { assessment: "Lab Report", grade: 51 },
      { assessment: "Assignment 3", grade: 39 },
    ],
    learningOutcomes: [
      { lo: "LO1: Data Structures", score: 55, target: 70 },
      { lo: "LO2: Algorithmic Thinking", score: 48, target: 70 },
      { lo: "LO3: ML Fundamentals", score: 52, target: 70 },
      { lo: "LO4: Model Evaluation", score: 42, target: 70 },
    ],
    recommendations: [
      "Recent sudden decline may indicate external factors",
      "Refer to student support services for wellbeing check",
      "Provide deadline extensions for current assignments",
      "Schedule 1-on-1 meeting to discuss workload",
    ],
  },
};

const StudentProfile = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const student = scenarioStudents[studentId || ""];

  if (!student) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Student not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const trendColor = student.trend === "improving" ? "text-success" : "text-destructive";
  const trendIcon = student.trend === "improving" ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      {/* Student Header */}
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold font-display">{student.name}</h2>
            <p className="text-sm text-muted-foreground">{student.modules.join(", ")}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold font-display">{student.avgGrade}%</span>
              <span className={trendColor}>{trendIcon}</span>
            </div>
            <Badge variant={student.trend === "improving" ? "default" : "destructive"}>
              {student.scenario}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grade Trajectory</CardTitle>
          <CardDescription>Performance over assessments</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={student.grades}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="assessment" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Line
                type="monotone"
                dataKey="grade"
                stroke={student.trend === "improving" ? "hsl(var(--success))" : "hsl(var(--destructive))"}
                strokeWidth={2.5}
                dot={{ r: 4, fill: student.trend === "improving" ? "hsl(var(--success))" : "hsl(var(--destructive))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Learning Outcomes */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Learning Outcomes</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {student.learningOutcomes.map((lo, i) => {
              const met = lo.score >= lo.target;
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{lo.lo}</span>
                    <span className={`font-bold ${met ? "text-success" : "text-destructive"}`}>
                      {lo.score}%
                    </span>
                  </div>
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${met ? "bg-success" : "bg-destructive"}`}
                      style={{ width: `${lo.score}%` }}
                    />
                    <div className="absolute inset-y-0 w-0.5 bg-foreground/40" style={{ left: `${lo.target}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* AI Recommendations */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">AI Recommendations</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {student.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border p-3">
                <BookOpen className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm">{rec}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentProfile;
