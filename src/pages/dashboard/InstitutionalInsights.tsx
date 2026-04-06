import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Award, Building2, Loader2, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const DEMO_DEPTS = [
  { dept: "Computer Science", students: 842, avgGrade: 62, passRate: 76, trend: "+2%" },
  { dept: "Mathematics", students: 534, avgGrade: 58, passRate: 71, trend: "-1%" },
  { dept: "Engineering", students: 678, avgGrade: 65, passRate: 80, trend: "+4%" },
  { dept: "Business", students: 1023, avgGrade: 68, passRate: 84, trend: "+1%" },
];

const DEMO_LOW = [
  { name: "CS205 - Final Exam", avgGrade: 42, passRate: 48, students: 134, issue: "Complexity too high" },
  { name: "MATH301 - Coursework 2", avgGrade: 45, passRate: 52, students: 98, issue: "Unclear rubric criteria" },
  { name: "ENG102 - Lab Report 3", avgGrade: 47, passRate: 55, students: 210, issue: "Insufficient scaffolding" },
];

const DEMO_ACCRED = [
  { metric: "Student Satisfaction (NSS)", value: 78, target: 80, status: "at-risk" },
  { metric: "Graduate Employment Rate", value: 92, target: 85, status: "met" },
  { metric: "Assessment Completion Rate", value: 87, target: 90, status: "at-risk" },
  { metric: "Module Pass Rate (Avg)", value: 76, target: 75, status: "met" },
  { metric: "Research-Led Teaching %", value: 68, target: 70, status: "below" },
];

const InstitutionalInsights = () => {
  const { isDemo } = useAuth();
  const [departmentStats, setDepartmentStats] = useState(DEMO_DEPTS);
  const [loading, setLoading] = useState(!isDemo);

  useEffect(() => {
    if (isDemo) return;
    const fetchData = async () => {
      try {
        const profilesSnap = await getDocs(collection(db, "profiles"));
        const gradesSnap = await getDocs(collection(db, "grades"));
        const subsSnap = await getDocs(collection(db, "submissions"));
        const scores = gradesSnap.docs.map(d => d.data().final_score ?? d.data().ai_score).filter(s => s != null) as number[];

        const deptMap: Record<string, number> = {};
        profilesSnap.docs.forEach(d => {
          const data = d.data();
          if (data.department_id) deptMap[data.department_id] = (deptMap[data.department_id] || 0) + 1;
        });
        if (Object.keys(deptMap).length > 0) {
          const avgAll = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 65;
          const passAll = scores.length > 0 ? Math.round((scores.filter(s => s >= 40).length / scores.length) * 100) : 75;
          setDepartmentStats(Object.entries(deptMap).map(([dept, count]) => ({
            dept, students: count, avgGrade: avgAll, passRate: passAll, trend: "+0%",
          })));
        }
      } catch (err) { console.error("Failed to fetch institutional data:", err); }
      setLoading(false);
    };
    fetchData();
  }, [isDemo]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="flex items-center gap-2 p-3">
            <Badge variant="outline" className="border-warning text-warning">Demo</Badge>
            <span className="text-sm text-muted-foreground">Viewing demo institutional data</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /><CardTitle className="text-base">Department Performance</CardTitle></div>
          <CardDescription>Cross-department comparison for 2024/25 academic year</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {departmentStats.map((dept, i) => (
              <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{dept.dept}</span>
                    <Badge variant={dept.passRate >= 80 ? "default" : dept.passRate >= 70 ? "secondary" : "destructive"}>{dept.passRate}% pass rate</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-6 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {dept.students} students</span>
                    <span>Avg: {dept.avgGrade}%</span>
                    <span className={dept.trend.startsWith("+") ? "text-success" : "text-destructive"}>{dept.trend}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" /><CardTitle className="text-base">Low-Performing Assessments</CardTitle></div>
            <CardDescription>Assessments requiring curriculum review</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {DEMO_LOW.map((a, i) => (
              <div key={i} className="rounded-lg border border-warning/20 bg-warning/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{a.name}</span>
                  <span className="text-lg font-bold font-display text-destructive">{a.avgGrade}%</span>
                </div>
                <p className="text-xs text-muted-foreground">{a.students} students · {a.passRate}% pass rate</p>
                <Badge variant="outline" className="text-xs border-warning/30">{a.issue}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" /><CardTitle className="text-base">Accreditation Readiness</CardTitle></div>
            <CardDescription>Key metrics for regulatory compliance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {DEMO_ACCRED.map((m, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{m.metric}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{m.value}%</span>
                    <Badge variant={m.status === "met" ? "default" : m.status === "at-risk" ? "secondary" : "destructive"} className="text-xs">
                      {m.status === "met" ? "Met" : m.status === "at-risk" ? "At Risk" : "Below"}
                    </Badge>
                  </div>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${m.status === "met" ? "bg-success" : m.status === "at-risk" ? "bg-warning" : "bg-destructive"}`} style={{ width: `${m.value}%` }} />
                  <div className="absolute inset-y-0 w-0.5 bg-foreground/40" style={{ left: `${m.target}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">Target: {m.target}%</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InstitutionalInsights;
