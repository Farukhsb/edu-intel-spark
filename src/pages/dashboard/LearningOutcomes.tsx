import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, CheckCircle, Target, TrendingDown, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

const modules = [
  { code: "CS301", name: "Data Structures" },
  { code: "CS205", name: "Algorithms" },
  { code: "CS102", name: "Intro to Programming" },
  { code: "CS401", name: "AI & ML" },
];

const learningOutcomesData: Record<string, Array<{
  id: string;
  outcome: string;
  studentAvg: number;
  target: number;
  status: "above" | "approaching" | "below";
  trend: Array<{ assessment: string; value: number }>;
}>> = {
  CS301: [
    { id: "LO1", outcome: "Understand fundamental data structures", studentAvg: 78, target: 70, status: "above",
      trend: [{ assessment: "A1", value: 65 }, { assessment: "A2", value: 72 }, { assessment: "A3", value: 78 }] },
    { id: "LO2", outcome: "Apply algorithmic thinking to problems", studentAvg: 52, target: 70, status: "below",
      trend: [{ assessment: "A1", value: 58 }, { assessment: "A2", value: 55 }, { assessment: "A3", value: 52 }] },
    { id: "LO3", outcome: "Implement sorting algorithms", studentAvg: 71, target: 70, status: "above",
      trend: [{ assessment: "A1", value: 60 }, { assessment: "A2", value: 68 }, { assessment: "A3", value: 71 }] },
    { id: "LO4", outcome: "Analyse time and space complexity", studentAvg: 45, target: 70, status: "below",
      trend: [{ assessment: "A1", value: 50 }, { assessment: "A2", value: 48 }, { assessment: "A3", value: 45 }] },
    { id: "LO5", outcome: "Design recursive solutions", studentAvg: 63, target: 70, status: "approaching",
      trend: [{ assessment: "A1", value: 55 }, { assessment: "A2", value: 60 }, { assessment: "A3", value: 63 }] },
  ],
  CS205: [
    { id: "LO1", outcome: "Understand graph algorithms", studentAvg: 66, target: 70, status: "approaching",
      trend: [{ assessment: "A1", value: 60 }, { assessment: "A2", value: 63 }, { assessment: "A3", value: 66 }] },
    { id: "LO2", outcome: "Apply dynamic programming", studentAvg: 48, target: 70, status: "below",
      trend: [{ assessment: "A1", value: 55 }, { assessment: "A2", value: 50 }, { assessment: "A3", value: 48 }] },
    { id: "LO3", outcome: "Evaluate algorithm efficiency", studentAvg: 72, target: 70, status: "above",
      trend: [{ assessment: "A1", value: 68 }, { assessment: "A2", value: 70 }, { assessment: "A3", value: 72 }] },
  ],
  CS102: [
    { id: "LO1", outcome: "Write basic programs", studentAvg: 82, target: 70, status: "above",
      trend: [{ assessment: "A1", value: 75 }, { assessment: "A2", value: 80 }, { assessment: "A3", value: 82 }] },
    { id: "LO2", outcome: "Understand control flow", studentAvg: 76, target: 70, status: "above",
      trend: [{ assessment: "A1", value: 70 }, { assessment: "A2", value: 74 }, { assessment: "A3", value: 76 }] },
    { id: "LO3", outcome: "Use functions and modular design", studentAvg: 68, target: 70, status: "approaching",
      trend: [{ assessment: "A1", value: 62 }, { assessment: "A2", value: 65 }, { assessment: "A3", value: 68 }] },
  ],
  CS401: [
    { id: "LO1", outcome: "Understand ML fundamentals", studentAvg: 70, target: 70, status: "above",
      trend: [{ assessment: "A1", value: 65 }, { assessment: "A2", value: 68 }, { assessment: "A3", value: 70 }] },
    { id: "LO2", outcome: "Apply supervised learning", studentAvg: 58, target: 70, status: "below",
      trend: [{ assessment: "A1", value: 55 }, { assessment: "A2", value: 56 }, { assessment: "A3", value: 58 }] },
    { id: "LO3", outcome: "Evaluate model performance", studentAvg: 64, target: 70, status: "approaching",
      trend: [{ assessment: "A1", value: 60 }, { assessment: "A2", value: 62 }, { assessment: "A3", value: 64 }] },
  ],
};

const studentTrajectories = [
  { name: "Alice Chen", module: "CS301", grades: [72, 68, 75, 80], trend: "improving" },
  { name: "David Lee", module: "CS301", grades: [65, 58, 45, 32], trend: "declining" },
  { name: "Emma Walsh", module: "CS205", grades: [70, 62, 55, 48], trend: "declining" },
  { name: "James Park", module: "CS102", grades: [60, 65, 70, 78], trend: "improving" },
];

const LearningOutcomes = () => {
  const [selectedModule, setSelectedModule] = useState("CS301");
  const [hoveredLO, setHoveredLO] = useState<string | null>(null);

  const outcomes = learningOutcomesData[selectedModule] || [];

  const statusIcon = (status: string) => {
    if (status === "above") return <CheckCircle className="h-4 w-4 text-success" />;
    if (status === "approaching") return <AlertTriangle className="h-4 w-4 text-warning" />;
    return <AlertTriangle className="h-4 w-4 text-destructive" />;
  };

  const statusColor = (status: string) => {
    if (status === "above") return "bg-success";
    if (status === "approaching") return "bg-warning";
    return "bg-destructive";
  };

  const statusBadge = (status: string) => {
    if (status === "above") return "default";
    if (status === "approaching") return "secondary";
    return "destructive";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Module Filter */}
      <div className="flex items-center gap-4">
        <Select value={selectedModule} onValueChange={setSelectedModule}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select module" />
          </SelectTrigger>
          <SelectContent>
            {modules.map((m) => (
              <SelectItem key={m.code} value={m.code}>
                {m.code} - {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Learning Outcomes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Learning Outcome Achievement</CardTitle>
          <CardDescription>
            {modules.find((m) => m.code === selectedModule)?.name} — Hover over an outcome to see the trend
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">ID</TableHead>
                <TableHead>Learning Outcome</TableHead>
                <TableHead className="text-center w-[100px]">Avg %</TableHead>
                <TableHead className="text-center w-[80px]">Target</TableHead>
                <TableHead className="w-[200px]">Progress</TableHead>
                <TableHead className="text-center w-[100px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outcomes.map((lo) => (
                <Tooltip key={lo.id}>
                  <TooltipTrigger asChild>
                    <TableRow
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredLO(lo.id)}
                      onMouseLeave={() => setHoveredLO(null)}
                    >
                      <TableCell className="font-medium">{lo.id}</TableCell>
                      <TableCell>{lo.outcome}</TableCell>
                      <TableCell className="text-center font-bold">{lo.studentAvg}%</TableCell>
                      <TableCell className="text-center text-muted-foreground">{lo.target}%</TableCell>
                      <TableCell>
                        <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full transition-all ${statusColor(lo.status)}`}
                            style={{ width: `${Math.min(lo.studentAvg, 100)}%` }}
                          />
                          <div
                            className="absolute inset-y-0 w-0.5 bg-foreground/50"
                            style={{ left: `${lo.target}%` }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={statusBadge(lo.status) as any} className="text-xs">
                          {lo.status === "above" ? "Above" : lo.status === "approaching" ? "Near" : "Below"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="p-3 w-[260px]">
                    <p className="text-xs font-medium mb-2">{lo.id} Trend Over Assessments</p>
                    <ResponsiveContainer width="100%" height={80}>
                      <LineChart data={lo.trend}>
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ r: 3, fill: "hsl(var(--primary))" }}
                        />
                        <XAxis dataKey="assessment" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                      </LineChart>
                    </ResponsiveContainer>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Student Achievement Trajectories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Student Achievement Trajectories</CardTitle>
          <CardDescription>Click a student to view detailed performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {studentTrajectories
            .filter((s) => s.module === selectedModule || selectedModule === "CS301")
            .map((student, i) => {
              const latest = student.grades[student.grades.length - 1];
              const prev = student.grades[student.grades.length - 2];
              const diff = latest - prev;
              const chartData = student.grades.map((g, idx) => ({ assessment: `A${idx + 1}`, grade: g }));

              return (
                <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{student.name}</span>
                      {student.trend === "improving" ? (
                        <TrendingUp className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Latest: {latest}% ({diff > 0 ? "+" : ""}{diff}%)
                    </p>
                  </div>
                  <div className="w-[120px] h-[40px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <Line
                          type="monotone"
                          dataKey="grade"
                          stroke={student.trend === "improving" ? "hsl(var(--success))" : "hsl(var(--destructive))"}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
};

export default LearningOutcomes;
