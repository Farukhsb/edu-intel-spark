import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
}

const StudentGrades = () => {
  const { user } = useAuth();
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ avg: 0, count: 0, highest: 0, lowest: 0 });

  useEffect(() => {
    const fetchGrades = async () => {
      if (!user) return;

      // Get student's submissions
      const { data: submissions } = await supabase
        .from("submissions")
        .select("*")
        .eq("student_id", user.id)
        .order("submitted_at", { ascending: false });

      if (!submissions?.length) { setLoading(false); return; }

      // Get assignments for context
      const assignmentIds = [...new Set(submissions.map((s: any) => s.assignment_id))];
      const { data: assignments } = await supabase
        .from("assignments")
        .select("id, title, module_code, max_score")
        .in("id", assignmentIds);

      const assignmentMap: Record<string, any> = {};
      (assignments || []).forEach((a: any) => { assignmentMap[a.id] = a; });

      // Get grades
      const subIds = submissions.map((s: any) => s.id);
      const { data: gradeData } = await supabase
        .from("grades")
        .select("*")
        .in("submission_id", subIds);

      const gradeMap: Record<string, any> = {};
      (gradeData || []).forEach((g: any) => { gradeMap[g.submission_id] = g; });

      const studentGrades: StudentGrade[] = submissions.map((s: any) => {
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
        };
      });

      setGrades(studentGrades);

      // Compute stats from released grades
      const releasedScores = studentGrades.filter((g) => g.score != null).map((g) => g.score!);
      if (releasedScores.length > 0) {
        setStats({
          avg: Math.round((releasedScores.reduce((a, b) => a + b, 0) / releasedScores.length) * 10) / 10,
          count: releasedScores.length,
          highest: Math.max(...releasedScores),
          lowest: Math.min(...releasedScores),
        });
      }
      setLoading(false);
    };

    fetchGrades();

    // Real-time listener for grade updates
    const channel = supabase
      .channel("student-grades-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => fetchGrades())
      .on("postgres_changes", { event: "*", schema: "public", table: "grades" }, () => fetchGrades())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Loading grades...</p></div>;

  const releasedGrades = grades.filter((g) => g.score != null);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Overview Stats */}
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

      {/* Grade Cards */}
      {grades.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No submissions yet. Head to Assignments to submit your work.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {grades.map((g) => (
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentGrades;
