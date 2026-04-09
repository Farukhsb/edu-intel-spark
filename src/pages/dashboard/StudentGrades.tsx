import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

interface StudentGrade {
  id: string;
  assignmentTitle: string;
  moduleCode: string | null;
  score: number | null;
  maxScore: number;
  feedback: string | null;
  status: string;
  submittedAt: string;
  breakdown: any[] | null;
  fileUrl: string | null;
}

const DEMO_GRADES: StudentGrade[] = [
  { id: "demo-1", assignmentTitle: "Assignment 1 - Data Structures", moduleCode: "CS301", score: 72, maxScore: 100, feedback: "Good understanding of binary trees. Consider edge cases in your traversal implementation.", status: "released", submittedAt: new Date(Date.now() - 7 * 86400000).toISOString(), breakdown: [{ criterion: "Correctness", score: 18, max_score: 25 }, { criterion: "Code Quality", score: 20, max_score: 25 }, { criterion: "Documentation", score: 16, max_score: 25 }, { criterion: "Testing", score: 18, max_score: 25 }], fileUrl: null },
  { id: "demo-2", assignmentTitle: "Assignment 2 - Algorithms", moduleCode: "CS205", score: 65, maxScore: 100, feedback: "Solid attempt at dynamic programming. Review time complexity analysis.", status: "released", submittedAt: new Date(Date.now() - 14 * 86400000).toISOString(), breakdown: [{ criterion: "Algorithm Design", score: 16, max_score: 25 }, { criterion: "Efficiency", score: 14, max_score: 25 }, { criterion: "Analysis", score: 17, max_score: 25 }, { criterion: "Presentation", score: 18, max_score: 25 }], fileUrl: null },
  { id: "demo-3", assignmentTitle: "Midterm Essay", moduleCode: "CS301", score: null, maxScore: 100, feedback: null, status: "submitted", submittedAt: new Date(Date.now() - 2 * 86400000).toISOString(), breakdown: null, fileUrl: null },
];

const StudentGrades = () => {
  const { user, isDemo } = useAuth();
  const [grades, setGrades] = useState<StudentGrade[]>(isDemo ? DEMO_GRADES : []);
  const [loading, setLoading] = useState(!isDemo);
  const [stats, setStats] = useState({ avg: 0, count: 0, highest: 0, lowest: 0 });

  useEffect(() => {
    if (isDemo) {
      const scores = DEMO_GRADES.filter(g => g.score != null).map(g => g.score!);
      setStats({ avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10, count: scores.length, highest: Math.max(...scores), lowest: Math.min(...scores) });
      return;
    }
    if (!user) { setLoading(false); return; }

    const fetchGrades = async () => {
      try {
        // Fetch only this student's submissions (RLS enforces this server-side too)
        const [subRes, assignRes] = await Promise.all([
          supabase.from("submissions").select("*").eq("student_id", user.id),
          supabase.from("assignments").select("*"),
        ]);

        const allSubs = (subRes.data || [])
          .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());

        // Fetch grades only for the student's submissions
        const subIds = allSubs.map(s => s.id);
        const gradeRes = subIds.length > 0
          ? await supabase.from("grades").select("*").in("submission_id", subIds)
          : { data: [] };

        const gradeData = gradeRes.data || [];

        const assignmentMap: Record<string, any> = {};
        (assignRes.data || []).forEach(a => { assignmentMap[a.id] = a; });

        const gradeMap: Record<string, any> = {};
        gradeData.forEach(g => { gradeMap[g.submission_id] = g; });

        const studentGrades: StudentGrade[] = allSubs.map(s => {
          const a = assignmentMap[s.assignment_id];
          const g = gradeMap[s.id];
          const isReleased = s.status === "released";
          return {
            id: s.id,
            assignmentTitle: a?.title || "Unknown",
            moduleCode: a?.module_code || null,
            score: isReleased ? (g?.final_score ?? g?.ai_score ?? null) : null,
            maxScore: a?.max_score || 100,
            feedback: isReleased ? (g?.final_feedback ?? g?.ai_feedback ?? null) : null,
            status: s.status,
            submittedAt: s.submitted_at,
            breakdown: isReleased ? (g?.ai_breakdown || null) : null,
            fileUrl: s.file_url || null,
          };
        });

        setGrades(studentGrades);

        const releasedScores = studentGrades.filter(g => g.score != null).map(g => g.score!);
        if (releasedScores.length > 0) {
          setStats({
            avg: Math.round((releasedScores.reduce((a, b) => a + b, 0) / releasedScores.length) * 10) / 10,
            count: releasedScores.length,
            highest: Math.max(...releasedScores),
            lowest: Math.min(...releasedScores),
          });
        }
      } catch (err) {
        console.error("Failed to fetch student grades:", err);
      }
      setLoading(false);
    };

    fetchGrades();
  }, [user]);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  const releasedGrades = grades.filter(g => g.score != null);

  return (
    <div className="space-y-6 animate-fade-in">
      {releasedGrades.length > 0 && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold font-display">{stats.avg}</p>
            <p className="text-xs text-muted-foreground">Average Score</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold font-display">{stats.count}</p>
            <p className="text-xs text-muted-foreground">Graded</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold font-display text-success">{stats.highest}</p>
            <p className="text-xs text-muted-foreground">Highest</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold font-display text-destructive">{stats.lowest}</p>
            <p className="text-xs text-muted-foreground">Lowest</p>
          </CardContent></Card>
        </div>
      )}

      {grades.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No submissions yet. Head to Assignments to submit your work.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {grades.map(g => (
            <Card key={g.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{g.assignmentTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.moduleCode && `${g.moduleCode} · `}
                      {new Date(g.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {g.score != null ? (
                      <>
                        <span className="text-xl font-bold font-display">{g.score}/{g.maxScore}</span>
                        <Badge variant={g.score >= g.maxScore * 0.7 ? "default" : g.score >= g.maxScore * 0.5 ? "secondary" : "destructive"}>
                          {Math.round((g.score / g.maxScore) * 100)}%
                        </Badge>
                      </>
                    ) : (
                      <Badge variant="outline" className="capitalize">{g.status.replace(/_/g, " ")}</Badge>
                    )}
                  </div>
                </div>
                {g.score != null && (
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${g.score >= g.maxScore * 0.7 ? "bg-success" : g.score >= g.maxScore * 0.5 ? "bg-primary" : "bg-destructive"}`}
                      style={{ width: `${(g.score / g.maxScore) * 100}%` }}
                    />
                  </div>
                )}
                {g.breakdown && Array.isArray(g.breakdown) && g.breakdown.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {g.breakdown.map((b: any, i: number) => (
                      <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                        {b.criterion}: {b.score}/{b.max_score}
                      </span>
                    ))}
                  </div>
                )}
                {g.feedback && <p className="text-sm text-muted-foreground">{g.feedback}</p>}
                {g.fileUrl && g.score != null && (
                  <Button variant="outline" size="sm" className="mt-1" onClick={() => window.open(g.fileUrl!, "_blank")}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download Submission
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentGrades;
