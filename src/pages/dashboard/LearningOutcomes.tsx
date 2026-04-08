import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CheckCircle, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface AssignmentOption { id: string; title: string; moduleCode: string | null }

interface OutcomeRow {
  criterion: string;
  avgScore: number;
  maxScore: number;
  pct: number;
  status: "above" | "approaching" | "below";
}

interface StudentTrajectory {
  name: string;
  scores: number[];
  trend: "improving" | "declining" | "stable";
}

const LearningOutcomes = () => {
  const { isDemo } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("all");
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([]);
  const [trajectories, setTrajectories] = useState<StudentTrajectory[]>([]);
  const [loading, setLoading] = useState(!isDemo);

  useEffect(() => {
    if (isDemo) { setLoading(false); return; }
    const fetchData = async () => {
      try {
        // Fetch assignments from Firebase
        const assignSnap = await getDocs(collection(db, "assignments"));
        const opts: AssignmentOption[] = assignSnap.docs.map(d => ({
          id: d.id, title: d.data().title, moduleCode: d.data().module_code || null,
        }));
        setAssignments(opts);

        // Fetch grades and submissions from Supabase (where AI grading data lives)
        const { data: gradesData } = await supabase.from("grades").select("*");
        const { data: subsData } = await supabase.from("submissions").select("*");

        // Build maps
        const subAssignment: Record<string, string> = {};
        const subStudent: Record<string, string> = {};
        (subsData || []).forEach(d => {
          subAssignment[d.id] = d.assignment_id;
          subStudent[d.id] = d.student_name || d.student_email || d.student_id || "Student";
        });

        // Collect rubric breakdowns per criterion
        const criterionScores: Record<string, { total: number; max: number; count: number }> = {};
        const studentScores: Record<string, number[]> = {};

        (gradesData || []).forEach(d => {
          const assignmentId = subAssignment[d.submission_id];
          if (selectedAssignment !== "all" && assignmentId !== selectedAssignment) return;

          const score = d.final_score ?? d.ai_score;
          const studentKey = subStudent[d.submission_id] || "Student";
          if (score != null) {
            if (!studentScores[studentKey]) studentScores[studentKey] = [];
            studentScores[studentKey].push(Number(score));
          }

          const breakdown = d.ai_breakdown as any;
          if (breakdown && Array.isArray(breakdown)) {
            breakdown.forEach((b: any) => {
              const key = b.criterion || b.name || "Unknown";
              if (!criterionScores[key]) criterionScores[key] = { total: 0, max: 0, count: 0 };
              criterionScores[key].total += (b.score ?? 0);
              criterionScores[key].max += (b.max_score ?? b.maxScore ?? 10);
              criterionScores[key].count++;
            });
          }
        });

        const outcomeRows: OutcomeRow[] = Object.entries(criterionScores).map(([criterion, data]) => {
          const avg = data.count > 0 ? Math.round(data.total / data.count * 10) / 10 : 0;
          const maxAvg = data.count > 0 ? Math.round(data.max / data.count * 10) / 10 : 10;
          const pct = maxAvg > 0 ? Math.round((avg / maxAvg) * 100) : 0;
          return {
            criterion,
            avgScore: avg,
            maxScore: maxAvg,
            pct,
            status: pct >= 70 ? "above" : pct >= 50 ? "approaching" : "below",
          };
        });
        setOutcomes(outcomeRows);

        const trajs: StudentTrajectory[] = Object.entries(studentScores)
          .filter(([, scores]) => scores.length >= 2)
          .slice(0, 8)
          .map(([name, scores]) => {
            const last = scores[scores.length - 1];
            const prev = scores[scores.length - 2];
            return {
              name,
              scores,
              trend: last > prev + 3 ? "improving" : last < prev - 3 ? "declining" : "stable",
            };
          });
        setTrajectories(trajs);
      } catch (err) {
        console.error("Learning outcomes fetch error:", err);
      }
      setLoading(false);
    };
    fetchData();
  }, [isDemo, selectedAssignment]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const statusColor = (s: string) => s === "above" ? "bg-success" : s === "approaching" ? "bg-warning" : "bg-destructive";
  const statusBadge = (s: string) => s === "above" ? "default" : s === "approaching" ? "secondary" : "destructive";
  const statusLabel = (s: string) => s === "above" ? "Above" : s === "approaching" ? "Near" : "Below";

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="flex items-center gap-2 p-3">
            <Badge variant="outline" className="border-warning text-warning">Demo</Badge>
            <span className="text-sm text-muted-foreground">Viewing demo learning outcomes</span>
          </CardContent>
        </Card>
      )}

      {assignments.length > 0 && (
        <div className="flex items-center gap-4">
          <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
            <SelectTrigger className="w-[280px]"><SelectValue placeholder="Select assignment" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignments</SelectItem>
              {assignments.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.moduleCode ? `${a.moduleCode} — ` : ""}{a.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rubric Criterion Achievement</CardTitle>
          <CardDescription>Average scores per rubric criterion across graded submissions</CardDescription>
        </CardHeader>
        <CardContent>
          {outcomes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No rubric breakdown data available yet. Grades need AI breakdown to populate this view.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Criterion</TableHead>
                  <TableHead className="text-center w-[100px]">Avg Score</TableHead>
                  <TableHead className="text-center w-[80px]">Max</TableHead>
                  <TableHead className="w-[200px]">Progress</TableHead>
                  <TableHead className="text-center w-[100px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outcomes.map((lo, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{lo.criterion}</TableCell>
                    <TableCell className="text-center font-bold">{lo.avgScore}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{lo.maxScore}</TableCell>
                    <TableCell>
                      <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full transition-all ${statusColor(lo.status)}`} style={{ width: `${Math.min(lo.pct, 100)}%` }} />
                        <div className="absolute inset-y-0 w-0.5 bg-foreground/50" style={{ left: "70%" }} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusBadge(lo.status) as any} className="text-xs">{statusLabel(lo.status)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {trajectories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student Achievement Trajectories</CardTitle>
            <CardDescription>Students with multiple graded submissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {trajectories.map((student, i) => {
              const latest = student.scores[student.scores.length - 1];
              const prev = student.scores.length >= 2 ? student.scores[student.scores.length - 2] : latest;
              const diff = latest - prev;
              const chartData = student.scores.map((g, idx) => ({ a: `A${idx + 1}`, grade: g }));

              return (
                <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{student.name}</span>
                      {student.trend === "improving" ? (
                        <TrendingUp className="h-3.5 w-3.5 text-success" />
                      ) : student.trend === "declining" ? (
                        <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                      ) : null}
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
                          stroke={student.trend === "improving" ? "hsl(var(--success))" : student.trend === "declining" ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
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
      )}
    </div>
  );
};

export default LearningOutcomes;
