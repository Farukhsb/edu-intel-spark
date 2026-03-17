import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  BookOpen,
  CheckCircle,
  Clock,
  FileText,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

const stats = [
  { label: "Total Submissions", value: "1,247", change: "+12%", icon: FileText, trend: "up" },
  { label: "Graded This Week", value: "89", change: "+24%", icon: CheckCircle, trend: "up" },
  { label: "Avg. Grade", value: "62.4%", change: "-2.1%", icon: BarChart3, trend: "down" },
  { label: "Active Students", value: "342", change: "+5%", icon: Users, trend: "up" },
];

const recentSubmissions = [
  { student: "Alice Chen", module: "CS301 - Data Structures", grade: 78, status: "graded", time: "2h ago" },
  { student: "James Wright", module: "CS301 - Data Structures", grade: 54, status: "graded", time: "3h ago" },
  { student: "Priya Patel", module: "CS205 - Algorithms", grade: null, status: "pending", time: "5h ago" },
  { student: "Omar Hassan", module: "CS205 - Algorithms", grade: null, status: "pending", time: "6h ago" },
  { student: "Sophie Brown", module: "CS102 - Intro to Programming", grade: 85, status: "graded", time: "1d ago" },
];

const commonMistakes = [
  { topic: "Recursion base cases", frequency: 67, severity: "high" },
  { topic: "Big-O analysis errors", frequency: 54, severity: "high" },
  { topic: "Memory management", frequency: 41, severity: "medium" },
  { topic: "Variable scoping", frequency: 28, severity: "low" },
];

const LecturerOverview = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display">{stat.value}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                  <span
                    className={`flex items-center text-xs font-medium ${
                      stat.trend === "up" ? "text-success" : "text-destructive"
                    }`}
                  >
                    {stat.trend === "up" ? (
                      <TrendingUp className="mr-0.5 h-3 w-3" />
                    ) : (
                      <TrendingDown className="mr-0.5 h-3 w-3" />
                    )}
                    {stat.change}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Submissions */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Recent Submissions</CardTitle>
            <CardDescription>Latest student submissions across modules</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentSubmissions.map((sub, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{sub.student}</p>
                    <p className="text-xs text-muted-foreground">{sub.module}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{sub.time}</span>
                    {sub.status === "graded" ? (
                      <Badge
                        variant={sub.grade! >= 70 ? "default" : sub.grade! >= 50 ? "secondary" : "destructive"}
                      >
                        {sub.grade}%
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-warning">
                        <Clock className="mr-1 h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Common Mistakes */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Common Mistakes</CardTitle>
            <CardDescription>Most frequent issues across cohort</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {commonMistakes.map((mistake, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{mistake.topic}</span>
                    <Badge
                      variant={
                        mistake.severity === "high"
                          ? "destructive"
                          : mistake.severity === "medium"
                          ? "secondary"
                          : "outline"
                      }
                      className="text-xs"
                    >
                      {mistake.severity}
                    </Badge>
                  </div>
                  <Progress value={mistake.frequency} className="h-2" />
                  <p className="text-xs text-muted-foreground">{mistake.frequency}% of submissions</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LecturerOverview;
