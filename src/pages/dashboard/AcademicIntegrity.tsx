import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Bot, Eye, FileSearch, Shield, ShieldAlert, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

interface OverviewStat {
  label: string;
  value: string;
  icon: React.ElementType;
}

interface FlaggedSubmission {
  student: string;
  assignment: string;
  aiProbability: number;
  styleMismatch: number;
  structuralScore: number;
  riskLevel: string;
  flags: string[];
}

const DEMO_OVERVIEW: OverviewStat[] = [
  { label: "Submissions Scanned", value: "1,247", icon: FileSearch },
  { label: "Flagged for Review", value: "23", icon: AlertTriangle },
  { label: "AI-Content Detected", value: "14", icon: Bot },
  { label: "Cleared", value: "1,210", icon: Shield },
];

const DEMO_FLAGGED: FlaggedSubmission[] = [
  { student: "Anonymous #47", assignment: "CS301", aiProbability: 89, styleMismatch: 76, structuralScore: 82, riskLevel: "high", flags: ["AI-generated probability high", "Writing style inconsistent"] },
  { student: "Anonymous #112", assignment: "CS205", aiProbability: 72, styleMismatch: 65, structuralScore: 58, riskLevel: "high", flags: ["Vocabulary complexity jump", "Structural patterns match AI"] },
  { student: "Anonymous #203", assignment: "CS301", aiProbability: 54, styleMismatch: 42, structuralScore: 61, riskLevel: "medium", flags: ["Moderate AI indicators"] },
  { student: "Anonymous #88", assignment: "CS102", aiProbability: 38, styleMismatch: 55, structuralScore: 35, riskLevel: "low", flags: ["Style shift noted", "Likely legitimate"] },
];

const AcademicIntegrity = () => {
  const { isDemo } = useAuth();
  const [overview, setOverview] = useState<OverviewStat[]>(DEMO_OVERVIEW);
  const [flagged, setFlagged] = useState<FlaggedSubmission[]>(DEMO_FLAGGED);
  const [loading, setLoading] = useState(!isDemo);

  useEffect(() => {
    if (isDemo) return;
    const fetchData = async () => {
      try {
        const subsSnap = await getDocs(collection(db, "submissions"));
        const gradesSnap = await getDocs(collection(db, "grades"));
        const assignmentsSnap = await getDocs(collection(db, "assignments"));

        const totalScanned = subsSnap.size;
        const assignmentMap: Record<string, string> = {};
        assignmentsSnap.docs.forEach(d => { assignmentMap[d.id] = d.data().title; });

        const subAssignment: Record<string, string> = {};
        const subStudent: Record<string, string> = {};
        subsSnap.docs.forEach(d => {
          const data = d.data();
          subAssignment[d.id] = data.assignment_id;
          subStudent[d.id] = data.student_name || data.student_email || `Student ${d.id.slice(0, 6)}`;
        });

        // Analyse grades for integrity signals
        let flaggedCount = 0;
        const flaggedItems: FlaggedSubmission[] = [];

        gradesSnap.docs.forEach(d => {
          const data = d.data();
          const breakdown = data.ai_breakdown;
          const score = data.final_score ?? data.ai_score;
          const assignmentId = subAssignment[data.submission_id];
          const studentName = subStudent[data.submission_id] || "Anonymous";
          const assignmentTitle = assignmentMap[assignmentId] || "Unknown";

          // Flag if score is suspiciously high with no rubric variation or if AI feedback mentions concerns
          let aiProb = 0;
          let styleMismatch = 0;
          let structural = 0;
          const flags: string[] = [];

          if (score != null && score > 95) {
            aiProb += 30;
            flags.push("Unusually high score");
          }

          if (breakdown && Array.isArray(breakdown)) {
            const scores = breakdown.map((b: any) => b.score ?? 0);
            const maxScores = breakdown.map((b: any) => b.max_score ?? 10);
            const ratios = scores.map((s: number, i: number) => maxScores[i] > 0 ? s / maxScores[i] : 0);
            const variance = ratios.length > 1 ? ratios.reduce((sum, r) => sum + Math.pow(r - ratios.reduce((a, b) => a + b, 0) / ratios.length, 2), 0) / ratios.length : 0;

            if (variance < 0.01 && ratios.length > 2) {
              aiProb += 40;
              styleMismatch += 30;
              flags.push("Uniform scores across criteria — possible AI generation");
            }

            const perfectCount = ratios.filter(r => r >= 0.95).length;
            if (perfectCount >= ratios.length * 0.8 && ratios.length > 2) {
              structural += 40;
              flags.push("Near-perfect across all rubric criteria");
            }
          }

          if (data.ai_feedback && typeof data.ai_feedback === "string") {
            const feedback = data.ai_feedback.toLowerCase();
            if (feedback.includes("ai-generated") || feedback.includes("machine-generated")) {
              aiProb += 30;
              flags.push("AI grader flagged potential AI content");
            }
            if (feedback.includes("inconsistent style") || feedback.includes("style mismatch")) {
              styleMismatch += 40;
              flags.push("Writing style inconsistency detected");
            }
          }

          if (aiProb > 30 || styleMismatch > 30 || structural > 30) {
            flaggedCount++;
            const riskLevel = (aiProb + styleMismatch + structural) > 80 ? "high" : (aiProb + styleMismatch + structural) > 40 ? "medium" : "low";
            flaggedItems.push({
              student: `Anonymous #${studentName.slice(-4)}`,
              assignment: assignmentTitle,
              aiProbability: Math.min(aiProb, 100),
              styleMismatch: Math.min(styleMismatch, 100),
              structuralScore: Math.min(structural, 100),
              riskLevel,
              flags,
            });
          }
        });

        flaggedItems.sort((a, b) => (b.aiProbability + b.styleMismatch + b.structuralScore) - (a.aiProbability + a.styleMismatch + a.structuralScore));

        setOverview([
          { label: "Submissions Scanned", value: totalScanned.toString(), icon: FileSearch },
          { label: "Flagged for Review", value: flaggedCount.toString(), icon: AlertTriangle },
          { label: "AI-Content Suspected", value: flaggedItems.filter(f => f.aiProbability > 50).length.toString(), icon: Bot },
          { label: "Cleared", value: (totalScanned - flaggedCount).toString(), icon: Shield },
        ]);

        if (flaggedItems.length > 0) setFlagged(flaggedItems.slice(0, 10));
      } catch (err) {
        console.error("Failed to fetch integrity data:", err);
      }
      setLoading(false);
    };
    fetchData();
  }, [isDemo]);

  const riskColor = (level: string) => level === "high" ? "destructive" : level === "medium" ? "secondary" : "outline";
  const scoreColor = (score: number) => score >= 70 ? "text-destructive" : score >= 50 ? "text-warning" : "text-success";

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="flex items-center gap-2 p-3">
            <Badge variant="outline" className="border-warning text-warning">Demo</Badge>
            <span className="text-sm text-muted-foreground">Viewing demo integrity data</span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overview.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <CardTitle className="text-base">Flagged Submissions</CardTitle>
          </div>
          <CardDescription>Submissions requiring academic integrity review</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {flagged.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No flagged submissions</p>
          ) : flagged.map((sub, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">{sub.student}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{sub.assignment}</span>
                </div>
                <Badge variant={riskColor(sub.riskLevel) as any}>{sub.riskLevel} risk</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "AI Probability", value: sub.aiProbability },
                  { label: "Style Mismatch", value: sub.styleMismatch },
                  { label: "Structural Score", value: sub.structuralScore },
                ].map((metric) => (
                  <div key={metric.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{metric.label}</span>
                      <span className={`font-bold ${scoreColor(metric.value)}`}>{metric.value}%</span>
                    </div>
                    <Progress value={metric.value} className="h-1.5" />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sub.flags.map((f, j) => (
                  <Badge key={j} variant="outline" className="text-xs">{f}</Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcademicIntegrity;
