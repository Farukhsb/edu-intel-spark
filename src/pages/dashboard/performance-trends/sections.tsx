import { AlertTriangle, BellRing, Lightbulb, TrendingDown, TrendingUp, Target, User, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, LineChart, Line } from "recharts";

import type { AtRiskStudent } from "@/lib/studentRisk";
import type { GradeDistributionEntry } from "@/lib/performanceAnalytics";

export const PerformanceFiltersBar = ({
  modules,
  moduleFilter,
  riskFilter,
  scoreBandFilter,
  atRiskCount,
  onModuleFilterChange,
  onRiskFilterChange,
  onScoreBandFilterChange,
}: {
  modules: string[];
  moduleFilter: string;
  riskFilter: string;
  scoreBandFilter: string;
  atRiskCount: number;
  onModuleFilterChange: (value: string) => void;
  onRiskFilterChange: (value: string) => void;
  onScoreBandFilterChange: (value: string) => void;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-4">
    <div className="flex flex-wrap items-center gap-3">
      <Select value={moduleFilter} onValueChange={onModuleFilterChange}>
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

      <Select value={riskFilter} onValueChange={onRiskFilterChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by risk" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All risk levels</SelectItem>
          <SelectItem value="high-plus">High + critical</SelectItem>
          <SelectItem value="critical">Critical only</SelectItem>
          <SelectItem value="high">High only</SelectItem>
          <SelectItem value="moderate">Moderate only</SelectItem>
        </SelectContent>
      </Select>

      <Select value={scoreBandFilter} onValueChange={onScoreBandFilterChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by score band" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All score bands</SelectItem>
          <SelectItem value="lt40">Below 40%</SelectItem>
          <SelectItem value="40-49">40-49%</SelectItem>
          <SelectItem value="50-59">50-59%</SelectItem>
          <SelectItem value="60plus">60% and above</SelectItem>
        </SelectContent>
      </Select>
    </div>
    {atRiskCount > 0 && (
      <Badge variant="destructive" className="gap-1">
        <BellRing className="h-3 w-3" />
        {atRiskCount} at-risk student{atRiskCount > 1 ? "s" : ""}
      </Badge>
    )}
  </div>
);

export const FilteredInterventionBanner = ({
  count,
  onClear,
}: {
  count: number;
  onClear: () => void;
}) => (
  <Card className="border-primary/20 bg-primary/5">
    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p className="text-sm font-medium">Filtered intervention view</p>
        <p className="text-xs text-muted-foreground">
          Showing {count} student{count === 1 ? "" : "s"} matching the current risk and score criteria.
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onClear}>
        Clear filters
      </Button>
    </CardContent>
  </Card>
);

export const StudentSupportSummaryCard = ({
  filteredStudents,
  allAtRiskCount,
}: {
  filteredStudents: AtRiskStudent[];
  allAtRiskCount: number;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Student Support Summary</CardTitle>
      <CardDescription>Early support signals based on assessment patterns</CardDescription>
    </CardHeader>
    <CardContent>
      {filteredStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <TrendingUp className="mb-2 h-8 w-8 text-success" />
          <p className="text-sm">
            {allAtRiskCount === 0
              ? "No at-risk students detected. All students are performing above threshold."
              : "No students match the current filter combination."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredStudents.slice(0, 5).map((student) => (
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
            Based on: grade trajectory, average score, grade changes, expected next outcome, and submission frequency
          </p>
        </div>
      )}
    </CardContent>
  </Card>
);

const riskBorder = (level: AtRiskStudent["riskLevel"]) =>
  level === "critical"
    ? "border-destructive/40 bg-destructive/10"
    : level === "high"
      ? "border-destructive/20 bg-destructive/5"
      : "border-warning/30 bg-warning/5";

export const EarlySupportSignalsCard = ({
  students,
  allAtRiskCount,
  expandedStudent,
  onToggleStudent,
  onOpenStudentPlan,
  onContactStudent,
}: {
  students: AtRiskStudent[];
  allAtRiskCount: number;
  expandedStudent: string | null;
  onToggleStudent: (studentId: string) => void;
  onOpenStudentPlan: (studentId: string) => void;
  onContactStudent: (student: AtRiskStudent) => void;
}) => (
  <Card>
    <CardHeader>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <CardTitle className="text-base">Early Support Signals</CardTitle>
      </div>
      <CardDescription>
        Students highlighted for lecturer review, with trajectory evidence and suggested support actions
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {students.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {allAtRiskCount === 0
            ? "No at-risk students detected based on current grading data."
            : "No at-risk students match the current filter view."}
        </p>
      ) : (
        students.map((student) => {
          const sparkData = student.sparkline.map((value, index) => ({ x: index, y: value }));
          const isExpanded = expandedStudent === student.studentId;

          return (
            <div
              key={student.studentId}
              className={`cursor-pointer space-y-3 rounded-lg border p-4 transition-all hover:shadow-md ${riskBorder(student.riskLevel)}`}
              onClick={() => onToggleStudent(isExpanded ? "" : student.studentId)}
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
                      Avg: {student.avgGrade}% - Support Level: {student.riskScore}/100 - Expected Next: {student.predictedNext}%
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
                    {student.trend === "declining" ? <TrendingDown className="ml-1 inline-block h-4 w-4 text-destructive" /> : <Target className="ml-1 inline-block h-4 w-4 text-primary" />}
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
                      <p className="text-muted-foreground">Expected</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenStudentPlan(student.studentId);
                      }}
                    >
                      Open student plan
                    </Button>
                    {student.email && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={(event) => {
                          event.stopPropagation();
                          onContactStudent(student);
                        }}
                      >
                        <Bell className="mr-1 h-3 w-3" /> Contact Student
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </CardContent>
  </Card>
);
