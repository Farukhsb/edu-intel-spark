import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ArrowRight, CheckCircle, Lightbulb, Target, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, getDoc, doc } from "firebase/firestore";

// Demo fallbacks
const DEMO_DIST = [
  { band: "1st (70+)", count: 48, fill: "hsl(152, 56%, 45%)" },
  { band: "2:1 (60-69)", count: 82, fill: "hsl(205, 80%, 55%)" },
  { band: "2:2 (50-59)", count: 104, fill: "hsl(38, 92%, 60%)" },
  { band: "3rd (40-49)", count: 72, fill: "hsl(280, 55%, 55%)" },
  { band: "Fail (<40)", count: 36, fill: "hsl(0, 72%, 55%)" },
];

const DEMO_RECS = [
  { topic: "Recursion & Base Cases", reason: "67% of students failing to identify correct base cases", suggestion: "Add a dedicated workshop on tree recursion patterns", priority: "critical" },
  { topic: "Big-O Notation", reason: "Students confusing amortised vs worst-case analysis", suggestion: "Introduce comparison tables and benchmarking exercises", priority: "high" },
  { topic: "Dynamic Programming", reason: "Low engagement with practice problems", suggestion: "Gamify DP exercises with progressive difficulty levels", priority: "medium" },
];

interface ModuleData {
  id: string;
  code: string;
  title: string;
  avgGrade: number;
  submissions: number;
  passRate: number;
}

const CohortAnalytics = () => {
  const { isDemo } = useAuth();
  const [moduleFilter, setModuleFilter] = useState("all");
  const [gradeDistChart, setGradeDistChart] = useState(DEMO_DIST);
  const [recommendations] = useState(DEMO_RECS);
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [loading, setLoading] = useState(!isDemo);

  useEffect(() => {
    if (isDemo) return;
    const fetchData = async () => {
      try {
        const assignmentsSnap = await getDocs(collection(db, "assignments"));
        const subsSnap = await getDocs(collection(db, "submissions"));
        const gradesSnap = await getDocs(collection(db, "grades"));

        // Build grade lookup
        const gradeBySubmission: Record<string, number> = {};
        gradesSnap.docs.forEach(d => {
          const data = d.data();
          const score = data.final_score ?? data.ai_score;
          if (score != null) gradeBySubmission[data.submission_id] = score;
        });

        // Build submission lookup by assignment
        const subsByAssignment: Record<string, string[]> = {};
        subsSnap.docs.forEach(d => {
          const data = d.data();
          if (!subsByAssignment[data.assignment_id]) subsByAssignment[data.assignment_id] = [];
          subsByAssignment[data.assignment_id].push(d.id);
        });

        // All scores for distribution
        const allScores = Object.values(gradeBySubmission);

        if (allScores.length > 0) {
          setGradeDistChart([
            { band: "1st (70+)", count: allScores.filter(s => s >= 70).length, fill: "hsl(152, 56%, 45%)" },
            { band: "2:1 (60-69)", count: allScores.filter(s => s >= 60 && s < 70).length, fill: "hsl(205, 80%, 55%)" },
            { band: "2:2 (50-59)", count: allScores.filter(s => s >= 50 && s < 60).length, fill: "hsl(38, 92%, 60%)" },
            { band: "3rd (40-49)", count: allScores.filter(s => s >= 40 && s < 50).length, fill: "hsl(280, 55%, 55%)" },
            { band: "Fail (<40)", count: allScores.filter(s => s < 40).length, fill: "hsl(0, 72%, 55%)" },
          ]);
        }

        // Per-module stats
        const moduleData: ModuleData[] = assignmentsSnap.docs.map(d => {
          const data = d.data();
          const subIds = subsByAssignment[d.id] || [];
          const scores = subIds.map(sid => gradeBySubmission[sid]).filter(s => s != null) as number[];
          const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
          const pass = scores.length > 0 ? Math.round((scores.filter(s => s >= 40).length / scores.length) * 100) : 0;
          return {
            id: d.id,
            code: data.module_code || "—",
            title: data.title,
            avgGrade: avg,
            submissions: subIds.length,
            passRate: pass,
          };
        });
        setModules(moduleData);
      } catch (err) {
        console.error("Failed to fetch cohort data:", err);
      }
      setLoading(false);
    };
    fetchData();
  }, [isDemo]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const filteredModules = moduleFilter === "all" ? modules : modules.filter(m => m.id === moduleFilter);

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="flex items-center gap-2 p-3">
            <Badge variant="outline" className="border-warning text-warning">Demo</Badge>
            <span className="text-sm text-muted-foreground">Viewing demo cohort analytics</span>
          </CardContent>
        </Card>
      )}

      {modules.length > 0 && (
        <div className="flex items-center gap-4">
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder="Filter by assignment" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignments</SelectItem>
              {modules.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.code !== "—" ? `${m.code} — ` : ""}{m.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Tabs defaultValue="distribution">
        <TabsList>
          <TabsTrigger value="distribution">Grade Distribution</TabsTrigger>
          <TabsTrigger value="modules">Assignment Comparison</TabsTrigger>
          <TabsTrigger value="recommendations">AI Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="distribution" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Grade Distribution</CardTitle>
              <CardDescription>Cohort classification breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {gradeDistChart.every(d => d.count === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-8">No graded submissions yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={gradeDistChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="band" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {gradeDistChart.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="mt-4">
          {filteredModules.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No assignments found</CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredModules.map((mod) => (
                <Card key={mod.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{mod.code !== "—" ? `${mod.code} — ` : ""}{mod.title}</p>
                        <p className="mt-1 text-3xl font-bold font-display">{mod.avgGrade > 0 ? `${mod.avgGrade}%` : "—"}</p>
                        <p className="text-xs text-muted-foreground">Average Grade</p>
                      </div>
                      {mod.submissions > 0 && (
                        <Badge variant={mod.passRate >= 80 ? "default" : mod.passRate >= 70 ? "secondary" : "destructive"}>
                          {mod.passRate}% pass
                        </Badge>
                      )}
                    </div>
                    <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{mod.submissions} submissions</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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
                      <Badge variant={rec.priority === "critical" ? "destructive" : rec.priority === "high" ? "secondary" : "outline"} className="text-xs">{rec.priority}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.reason}</p>
                    <div className="flex items-center gap-1.5 pt-1 text-sm font-medium text-primary">
                      <ArrowRight className="h-3.5 w-3.5" />{rec.suggestion}
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
