import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, BookOpen, TrendingUp } from "lucide-react";

const grades = [
  {
    module: "CS301 - Data Structures",
    assessment: "Assignment 1",
    grade: 68,
    feedback: "Good understanding of linked lists. Improve recursion analysis.",
    date: "Oct 2024",
    band: "2:1",
  },
  {
    module: "CS301 - Data Structures",
    assessment: "Midterm Exam",
    grade: 54,
    feedback: "Weak on tree traversal algorithms. Review BFS/DFS patterns.",
    date: "Nov 2024",
    band: "2:2",
  },
  {
    module: "CS205 - Algorithms",
    assessment: "Assignment 1",
    grade: 72,
    feedback: "Excellent sorting implementation. Good code documentation.",
    date: "Nov 2024",
    band: "1st",
  },
  {
    module: "CS205 - Algorithms",
    assessment: "Lab Report 1",
    grade: 61,
    feedback: "Analysis section needs more depth. Include time complexity comparisons.",
    date: "Dec 2024",
    band: "2:1",
  },
  {
    module: "CS102 - Intro to Programming",
    assessment: "Final Project",
    grade: 78,
    feedback: "Well-structured code with clear OOP principles. Add more error handling.",
    date: "Jan 2025",
    band: "1st",
  },
];

const overallStats = {
  avgGrade: 66.6,
  totalAssessments: 5,
  highestGrade: 78,
  lowestGrade: 54,
};

const bandColor = (band: string) => {
  if (band === "1st") return "default";
  if (band === "2:1") return "secondary";
  if (band === "2:2") return "outline";
  return "destructive";
};

const StudentGrades = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Overview Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold font-display">{overallStats.avgGrade}%</p>
            <p className="text-xs text-muted-foreground">Average Grade</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold font-display">{overallStats.totalAssessments}</p>
            <p className="text-xs text-muted-foreground">Assessments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold font-display text-success">{overallStats.highestGrade}%</p>
            <p className="text-xs text-muted-foreground">Highest</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold font-display text-destructive">{overallStats.lowestGrade}%</p>
            <p className="text-xs text-muted-foreground">Lowest</p>
          </CardContent>
        </Card>
      </div>

      {/* Grade Cards */}
      <div className="space-y-3">
        {grades.map((g, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{g.assessment}</p>
                  <p className="text-xs text-muted-foreground">{g.module} · {g.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold font-display">{g.grade}%</span>
                  <Badge variant={bandColor(g.band) as any}>{g.band}</Badge>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${
                    g.grade >= 70 ? "bg-success" : g.grade >= 50 ? "bg-primary" : "bg-destructive"
                  }`}
                  style={{ width: `${g.grade}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">{g.feedback}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default StudentGrades;
