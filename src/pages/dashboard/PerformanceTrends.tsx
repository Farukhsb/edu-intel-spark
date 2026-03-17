import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

const assessments = [
  { name: "Assignment 1", avgGrade: 68, participation: 95, date: "Oct 2024" },
  { name: "Midterm Exam", avgGrade: 58, participation: 92, date: "Nov 2024" },
  { name: "Assignment 2", avgGrade: 62, participation: 88, date: "Dec 2024" },
  { name: "Lab Report 1", avgGrade: 71, participation: 85, date: "Jan 2025" },
  { name: "Assignment 3", avgGrade: 55, participation: 82, date: "Feb 2025" },
  { name: "Lab Report 2", avgGrade: 64, participation: 80, date: "Mar 2025" },
];

const gradeDistribution = [
  { band: "1st (70-100%)", count: 48, percentage: 14, color: "bg-success" },
  { band: "2:1 (60-69%)", count: 82, percentage: 24, color: "bg-info" },
  { band: "2:2 (50-59%)", count: 104, percentage: 30, color: "bg-warning" },
  { band: "3rd (40-49%)", count: 72, percentage: 21, color: "bg-accent" },
  { band: "Fail (<40%)", count: 36, percentage: 11, color: "bg-destructive" },
];

const atRiskStudents = [
  { name: "David Lee", trend: "declining", avgGrade: 38, lastGrade: 32, flags: ["Missed 2 submissions", "Below threshold"] },
  { name: "Emma Walsh", trend: "declining", avgGrade: 42, lastGrade: 35, flags: ["Grade drop >15%"] },
  { name: "Tom Baker", trend: "stable-low", avgGrade: 41, lastGrade: 40, flags: ["Consistently below threshold"] },
  { name: "Fatima Al-Rashid", trend: "declining", avgGrade: 51, lastGrade: 39, flags: ["Sudden drop", "Missed lab"] },
];

const PerformanceTrends = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Assessment Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assessment Timeline</CardTitle>
          <CardDescription>Average grade progression across assessments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {assessments.map((a, i) => {
              const prev = i > 0 ? assessments[i - 1].avgGrade : a.avgGrade;
              const diff = a.avgGrade - prev;
              return (
                <div key={i} className="flex items-center gap-4 rounded-lg border p-3">
                  <div className="w-20 text-xs text-muted-foreground">{a.date}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{a.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold font-display">{a.avgGrade}%</span>
                        {i > 0 && (
                          <span
                            className={`flex items-center text-xs ${
                              diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "text-muted-foreground"
                            }`}
                          >
                            {diff > 0 ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            {diff > 0 ? "+" : ""}{diff}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${a.avgGrade}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{a.participation}% participation</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Grade Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grade Distribution</CardTitle>
            <CardDescription>Current cohort breakdown by band</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {gradeDistribution.map((g, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{g.band}</span>
                  <span className="text-muted-foreground">{g.count} students ({g.percentage}%)</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${g.color}`} style={{ width: `${g.percentage * 3}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* At-Risk Students */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">At-Risk Students</CardTitle>
            <CardDescription>Students requiring early intervention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {atRiskStudents.map((s, i) => (
              <div key={i} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{s.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-destructive">{s.lastGrade}%</span>
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Avg: {s.avgGrade}%</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.flags.map((f, j) => (
                    <Badge key={j} variant="outline" className="border-destructive/30 text-xs text-destructive">
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PerformanceTrends;
