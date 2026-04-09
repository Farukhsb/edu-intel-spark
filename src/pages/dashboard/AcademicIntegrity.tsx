import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Bot, FileSearch, Shield, ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

const AcademicIntegrity = () => {
  const [overview, setOverview] = useState<OverviewStat[]>([]);
  const [flagged, setFlagged] = useState<FlaggedSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ data: subsData }, { data: gradesData }, { data: assignmentsData }] = await Promise.all([
          supabase.from("submissions").select("*"),
          supabase.from("grades").select("*"),
          supabase.from("assignments").select("*"),
        ]);

        const totalScanned = subsData?.length ?? 0;
        const assignmentMap: Record<string, string> = {};
        assignmentsData?.forEach(a => { assignmentMap[a.id] = a.title; });

        const subAssignment: Record<string, string> = {};
        const subStudent: Record<string, string> = {};
        subsData?.forEach(s => {
          subAssignment[s.id] = s.assignment_id;
          subStudent[s.id] = s.student_name || s.student_email || `Student ${s.id.slice(0, 6)}`;
        });

        let flaggedCount = 0;
        const flaggedItems: FlaggedSubmission[] = [];

        gradesData?.forEach(d => {
          const breakdown = d.ai_breakdown as any;
          const score = d.final_score ?? d.ai_score;
          const assignmentId = subAssignment[d.submission_id];
          const studentName = subStudent[d.submission_id] || "Anonymous";
          const assignmentTitle = assignmentMap[assignmentId] || "Unknown";

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
            const maxScores = breakdown.map((b: any) => b.max_score ?? b.maxScore ?? 10);
            const ratios = scores.map((s: number, i: number) => maxScores[i] > 0 ? s / maxScores[i] : 0);
            const avg = ratios.length > 0 ? ratios.reduce((a: number, b: number) => a + b, 0) / ratios.length : 0;
            const variance = ratios.length > 1 ? ratios.reduce((sum: number, r: number) => sum + Math.pow(r - avg, 2), 0) / ratios.length : 0;

            if (variance < 0.01 && ratios.length > 2) {
              aiProb += 40;
              styleMismatch += 30;
              flags.push("Uniform scores across criteria — possible AI generation");
            }

            const perfectCount = ratios.filter((r: number) => r >= 0.95).length;
            if (perfectCount >= ratios.length * 0.8 && ratios.length > 2) {
              structural += 40;
              flags.push("Near-perfect across all rubric criteria");
            }
          }

          if (d.ai_feedback && typeof d.ai_feedback === "string") {
            const feedback = d.ai_feedback.toLowerCase();
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
            const total = aiProb + styleMismatch + structural;
            const riskLevel = total > 80 ? "high" : total > 40 ? "medium" : "low";
            flaggedItems.push({
              student: studentName,
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

        setFlagged(flaggedItems.slice(0, 10));
      } catch (err) {
        console.error("Failed to fetch integrity data:", err);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const riskColor = (level: string) => level === "high" ? "destructive" : level === "medium" ? "secondary" : "outline";
  const scoreColor = (score: number) => score >= 70 ? "text-destructive" : score >= 50 ? "text-warning" : "text-success";

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
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
            <p className="text-sm text-muted-foreground text-center py-6">No flagged submissions — all submissions look clean</p>
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
