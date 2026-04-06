import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingDown, TrendingUp, AlertTriangle, Lightbulb, User, Loader2 } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const DEMO_ASSESSMENTS = [
  { name: "Assignment 1", avgGrade: 68, participation: 95 },
  { name: "Midterm Exam", avgGrade: 58, participation: 92 },
  { name: "Assignment 2", avgGrade: 62, participation: 88 },
  { name: "Lab Report 1", avgGrade: 71, participation: 85 },
  { name: "Assignment 3", avgGrade: 55, participation: 82 },
  { name: "Lab Report 2", avgGrade: 64, participation: 80 },
];

const DEMO_DIST = [
  { band: "1st (70-100%)", count: 48, percentage: 14, fill: "hsl(152, 56%, 45%)" },
  { band: "2:1 (60-69%)", count: 82, percentage: 24, fill: "hsl(205, 80%, 55%)" },
  { band: "2:2 (50-59%)", count: 104, percentage: 30, fill: "hsl(38, 92%, 60%)" },
  { band: "3rd (40-49%)", count: 72, percentage: 21, fill: "hsl(280, 55%, 55%)" },
  { band: "Fail (<40%)", count: 36, percentage: 11, fill: "hsl(0, 72%, 55%)" },
];

const DEMO_HEATMAP = [
  { week: "W1", mon: 85, tue: 90, wed: 78, thu: 92, fri: 65 },
  { week: "W2", mon: 88, tue: 85, wed: 82, thu: 90, fri: 60 },
  { week: "W3", mon: 80, tue: 82, wed: 75, thu: 85, fri: 55 },
  { week: "W4", mon: 75, tue: 78, wed: 70, thu: 80, fri: 50 },
  { week: "W5", mon: 70, tue: 75, wed: 68, thu: 78, fri: 48 },
  { week: "W6", mon: 65, tue: 70, wed: 62, thu: 72, fri: 42 },
];

const DEMO_ATRISK = [
  { name: "David Lee", trend: "declining" as const, avgGrade: 38, lastGrade: 32, flags: ["Missed 2 submissions", "Below threshold"], sparkline: [65, 58, 45, 38, 32], recommendation: "Suggest tutoring session. Consider extending deadline." },
  { name: "Emma Walsh", trend: "declining" as const, avgGrade: 42, lastGrade: 35, flags: ["Grade drop >15%"], sparkline: [70, 62, 55, 42, 35], recommendation: "Schedule 1-on-1 meeting. Review study habits." },
  { name: "Tom Baker", trend: "stable-low" as const, avgGrade: 41, lastGrade: 40, flags: ["Consistently below threshold"], sparkline: [42, 40, 41, 40, 40], recommendation: "Assign peer mentor. Provide practice materials." },
  { name: "Fatima Al-Rashid", trend: "declining" as const, avgGrade: 51, lastGrade: 39, flags: ["Sudden drop", "Missed lab"], sparkline: [68, 60, 55, 51, 39], recommendation: "Refer to student support services." },
];

const PerformanceTrends = () => {
  const { isDemo } = useAuth();
  const [moduleFilter, setModuleFilter] = useState("all");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isDemo);

  useEffect(() => {
    if (isDemo) { setLoading(false); return; }
    const fetchData = async () => {
      try {
        const gradesSnap = await getDocs(collection(db, "grades"));
        const subsSnap = await getDocs(collection(db, "submissions"));
        const scores = gradesSnap.docs.map(d => d.data().final_score ?? d.data().ai_score).filter(s => s != null) as number[];

        if (scores.length > 0) {
          // Build real grade distribution
          const dist = [
            { band: "1st (70-100%)", count: scores.filter(s => s >= 70).length, percentage: 0, fill: "hsl(152, 56%, 45%)" },
            { band: "2:1 (60-69%)", count: scores.filter(s => s >= 60 && s < 70).length, percentage: 0, fill: "hsl(205, 80%, 55%)" },
            { band: "2:2 (50-59%)", count: scores.filter(s => s >= 50 && s < 60).length, percentage: 0, fill: "hsl(38, 92%, 60%)" },
            { band: "3rd (40-49%)", count: scores.filter(s => s >= 40 && s < 50).length, percentage: 0, fill: "hsl(280, 55%, 55%)" },
            { band: "Fail (<40%)", count: scores.filter(s => s < 40).length, percentage: 0, fill: "hsl(0, 72%, 55%)" },
          ];
          const total = scores.length;
          dist.forEach(d => d.percentage = Math.round((d.count / total) * 100));
        }

        // Build at-risk students from submissions with low scores
        const studentScores: Record<string, { name: string; scores: number[] }> = {};
        subsSnap.docs.forEach(d => {
          const s = d.data();
          const key = s.student_id || s.student_name || s.student_email;
          if (!key) return;
          const name = s.student_name || s.student_email || "Unknown";
          if (!studentScores[key]) studentScores[key] = { name, scores: [] };
          const g = gradesSnap.docs.find(gd => gd.data().submission_id === d.id);
          const score = g?.data()?.final_score ?? g?.data()?.ai_score;
          if (score != null) studentScores[key].scores.push(score);
        });
      } catch (err) { console.error("Failed to fetch performance data:", err); }
      setLoading(false);
    };
    fetchData();
  }, [isDemo]);

  const heatmapColor = (val: number) => {
    if (val >= 85) return "bg-success/80";
    if (val >= 70) return "bg-success/40";
    if (val >= 55) return "bg-warning/50";
    return "bg-destructive/40";
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="flex items-center gap-2 p-3">
            <Badge variant="outline" className="border-warning text-warning">Demo</Badge>
            <span className="text-sm text-muted-foreground">Viewing demo performance data</span>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-4">
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by module" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            <SelectItem value="CS301">CS301 - Data Structures</SelectItem>
            <SelectItem value="CS205">CS205 - Algorithms</SelectItem>
            <SelectItem value="CS102">CS102 - Intro to Prog</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Average Grades Over Time</CardTitle>
          <CardDescription>Assessment performance and participation trends</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={DEMO_ASSESSMENTS}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Legend />
              <Line type="monotone" dataKey="avgGrade" name="Avg Grade %" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="participation" name="Participation %" stroke="hsl(var(--success))" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grade Distribution</CardTitle>
            <CardDescription>Current cohort breakdown by classification</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={DEMO_DIST} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="band" tick={{ fontSize: 10 }} width={100} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} formatter={(value: number) => [`${value} students`, "Count"]} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {DEMO_DIST.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Engagement Heatmap</CardTitle>
            <CardDescription>Weekly participation rates by day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="grid grid-cols-6 gap-1 text-xs text-muted-foreground mb-1">
                <span></span><span className="text-center">Mon</span><span className="text-center">Tue</span><span className="text-center">Wed</span><span className="text-center">Thu</span><span className="text-center">Fri</span>
              </div>
              {DEMO_HEATMAP.map((row) => (
                <div key={row.week} className="grid grid-cols-6 gap-1">
                  <span className="text-xs text-muted-foreground flex items-center">{row.week}</span>
                  {[row.mon, row.tue, row.wed, row.thu, row.fri].map((val, i) => (
                    <div key={i} className={`h-8 rounded flex items-center justify-center text-[10px] font-medium ${heatmapColor(val)}`} title={`${val}%`}>{val}%</div>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-destructive/40" /> Low</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-warning/50" /> Medium</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-success/40" /> Good</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-success/80" /> High</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /><CardTitle className="text-base">At-Risk Students</CardTitle></div>
          <CardDescription>Students requiring early intervention — click for recommendations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DEMO_ATRISK.map((s, i) => {
            const sparkData = s.sparkline.map((v, idx) => ({ x: idx, y: v }));
            const isExpanded = expandedStudent === s.name;
            return (
              <div key={i} className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3 cursor-pointer transition-all hover:border-destructive/40" onClick={() => setExpandedStudent(isExpanded ? null : s.name)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                      <User className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <span className="text-sm font-medium">{s.name}</span>
                      <p className="text-xs text-muted-foreground">Avg: {s.avgGrade}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-[80px] h-[30px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparkData}>
                          <Line type="monotone" dataKey="y" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-destructive">{s.lastGrade}%</span>
                      <TrendingDown className="inline-block ml-1 h-4 w-4 text-destructive" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.flags.map((f, j) => <Badge key={j} variant="outline" className="border-destructive/30 text-xs text-destructive">{f}</Badge>)}
                </div>
                {isExpanded && (
                  <div className="rounded-lg bg-card border p-3 mt-2 flex items-start gap-2 animate-fade-in">
                    <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-primary mb-1">AI Recommendation</p>
                      <p className="text-sm text-muted-foreground">{s.recommendation}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceTrends;
