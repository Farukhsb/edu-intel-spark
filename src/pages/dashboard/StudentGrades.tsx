import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, getDocs, getDoc, doc } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

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

const StudentGrades = () => {
  const { user } = useAuth();
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ avg: 0, count: 0, highest: 0, lowest: 0 });

  const loadSubmissions = async (uid: string, email: string | null) => {
    let submissions: any[] = [];

    // Try student_id first, then email – use getDocs to avoid needing composite index
    try {
      const q1 = query(collection(db, "submissions"), where("student_id", "==", uid));
      const snap1 = await getDocs(q1);
      submissions = snap1.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch { /* index / permission */ }

    if (submissions.length === 0 && email) {
      try {
        const q2 = query(collection(db, "submissions"), where("student_email", "==", email));
        const snap2 = await getDocs(q2);
        submissions = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch { /* ignore */ }
    }

    if (!submissions.length) {
      setGrades([]);
      setLoading(false);
      return;
    }

    // Sort client-side instead of relying on composite index
    submissions.sort((a, b) => (b.submitted_at || "").localeCompare(a.submitted_at || ""));

    // Get assignments for context
    const assignmentMap: Record<string, any> = {};
    const assignmentIds = [...new Set(submissions.map((s: any) => s.assignment_id))];
    for (const aId of assignmentIds) {
      try {
        const aSnap = await getDoc(doc(db, "assignments", aId));
        if (aSnap.exists()) assignmentMap[aId] = { ...aSnap.data(), id: aSnap.id };
      } catch { /* permission error */ }
    }

    // Get grades
    const gradeMap: Record<string, any> = {};
    for (const s of submissions) {
      try {
        const gSnap = await getDocs(
          query(collection(db, "grades"), where("submission_id", "==", s.id))
        );
        gSnap.docs.forEach((gDoc) => {
          gradeMap[s.id] = { id: gDoc.id, ...gDoc.data() };
        });
      } catch { /* ignore */ }
    }

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
        fileUrl: s.file_url || null,
      };
    });

    setGrades(studentGrades);

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

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadSubmissions(user.uid, user.email ?? null);
  }, [user]);

  if (loading) return (
    <div className="space-y-4 p-4 animate-pulse">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-lg bg-muted" />)}
      </div>
      <div className="h-32 rounded-lg bg-muted" />
      <div className="h-32 rounded-lg bg-muted" />
    </div>
  );

  const releasedGrades = grades.filter((g) => g.score != null);

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
