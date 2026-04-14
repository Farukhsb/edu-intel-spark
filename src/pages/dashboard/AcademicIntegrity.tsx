import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Bot, FileSearch, Shield, ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface OverviewStat {
  label: string;
  value: string;
  icon: React.ElementType;
}

interface FlaggedSubmission {
  submissionId: string;
  student: string;
  assignment: string;
  aiProbability: number;
  styleMismatch: number;
  structuralScore: number;
  riskLevel: string;
  flags: string[];
  reviewDecision: string | null;
}

const AcademicIntegrity = () => {
  const { user } = useAuth();
  const [overview, setOverview] = useState<OverviewStat[]>([]);
  const [flagged, setFlagged] = useState<FlaggedSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from("assignments")
          .select("*")
          .eq("lecturer_id", user.id);

        if (assignmentsError) throw assignmentsError;

        const assignments = assignmentsData || [];
        const assignmentIds = assignments.map((a) => a.id);

        if (assignmentIds.length === 0) {
          setOverview([
            { label: "Submissions Scanned", value: "0", icon: FileSearch },
            { label: "Flagged for Review", value: "0", icon: AlertTriangle },
            { label: "AI-Content Suspected", value: "0", icon: Bot },
            { label: "Cleared", value: "0", icon: Shield },
          ]);
          setFlagged([]);
          setLoading(false);
          return;
        }

        const { data: subsData, error: submissionsError } = await supabase
          .from("submissions")
          .select("*")
          .in("assignment_id", assignmentIds);

        if (submissionsError) throw submissionsError;

        const submissions = subsData || [];
        const submissionIds = submissions.map((s) => s.id);

        let gradesData: any[] = [];
        let existingReviews: Record<string, string> = {};

        if (submissionIds.length > 0) {
          const [{ data: grades, error: gradesError }, { data: reviews }] = await Promise.all([
            supabase.from("grades").select("*").in("submission_id", submissionIds),
            supabase.from("academic_integrity_reviews").select("submission_id, decision").eq("lecturer_id", user.id),
          ]);

          if (gradesError) throw gradesError;
          gradesData = grades || [];
          (reviews || []).forEach((r) => { existingReviews[r.submission_id] = r.decision; });
        }

        const totalScanned = submissions.length;
        const assignmentMap: Record<string, string> = {};
        assignments.forEach((a) => {
          assignmentMap[a.id] = a.title;
        });

        const subAssignment: Record<string, string> = {};
        const subStudent: Record<string, string> = {};
        submissions.forEach((s) => {
          subAssignment[s.id] = s.assignment_id;
          subStudent[s.id] = s.student_name || s.student_email || `Student ${s.id.slice(0, 6)}`;
        });

        let flaggedCount = 0;
        const flaggedItems: FlaggedSubmission[] = [];

        gradesData.forEach((d) => {
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
            const ratios = scores.map((s: number, i: number) =>
              maxScores[i] > 0 ? s / maxScores[i] : 0
            );
            const avg = ratios.length > 0 ? ratios.reduce((a: number, b: number) => a + b, 0) / ratios.length : 0;
            const variance =
              ratios.length > 1
                ? ratios.reduce((sum: number, r: number) => sum + Math.pow(r - avg, 2), 0) / ratios.length
                : 0;

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
              submissionId: d.submission_id,
              student: studentName,
              assignment: assignmentTitle,
              aiProbability: Math.min(aiProb, 100),
              styleMismatch: Math.min(styleMismatch, 100),
              structuralScore: Math.min(structural, 100),
              riskLevel,
              flags,
              reviewDecision: existingReviews[d.submission_id] || null,
            });
          }
        });

        flaggedItems.sort(
          (a, b) =>
            b.aiProbability + b.styleMismatch + b.structuralScore -
            (a.aiProbability + a.styleMismatch + a.structuralScore)
        );

        setOverview([
          { label: "Submissions Scanned", value: totalScanned.toString(), icon: FileSearch },
          { label: "Flagged for Review", value: flaggedCount.toString(), icon: AlertTriangle },
          { label: "AI-Content Suspected", value: flaggedItems.filter((f) => f.aiProbability > 50).length.toString(), icon: Bot },
          { label: "Cleared", value: (totalScanned - flaggedCount).toString(), icon: Shield },
        ]);

        setFlagged(flaggedItems.slice(0, 10));
      } catch (err) {
        console.error("Failed to fetch integrity data:", err);
      }
      setLoading(false);
    };

    void fetchData();
  }, [user?.id]);

  const saveReviewDecision = async (submissionId: string, decision: string, index: number) => {
    if (!user) return;

    // Determine review_type from flags
    const item = flagged[index];
    const reviewType = item.aiProbability > item.styleMismatch ? "ai-writing-suspicion" : "similarity-plagiarism-suspicion";
    const evidenceSummary = item.flags.join("; ");

    // Optimistic update
    setFlagged(prev => prev.map((f, i) => i === index ? { ...f, reviewDecision: decision } : f));

    const { error } = await supabase
      .from("academic_integrity_reviews")
      .upsert({
        submission_id: submissionId,
        lecturer_id: user.id,
        review_type: reviewType,
        decision,
        evidence_summary: evidenceSummary,
      }, { onConflict: "submission_id,lecturer_id" })
      .select();

    if (error) {
      // No unique constraint on (submission_id, lecturer_id) yet, fall back to insert
      const { error: insertError } = await supabase
        .from("academic_integrity_reviews")
        .insert({
          submission_id: submissionId,
          lecturer_id: user.id,
          review_type: reviewType,
          decision,
          evidence_summary: evidenceSummary,
        });

      if (insertError) {
        setFlagged(prev => prev.map((f, i) => i === index ? { ...f, reviewDecision: null } : f));
        toast.error("Failed to save review decision");
        return;
      }
    }

    toast.success(`Marked as "${decision}"`);
  };

  const riskColor = (level: string) =>
    level === "high" ? "destructive" : level === "medium" ? "secondary" : "outline";

  const scoreColor = (score: number) =>
    score >= 70 ? "text-destructive" : score >= 50 ? "text-warning" : "text-success";

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
                <div className="flex items-center gap-2">
                  {sub.reviewDecision && (
                    <Badge variant="outline" className="text-xs">{sub.reviewDecision}</Badge>
                  )}
                  <Badge variant={riskColor(sub.riskLevel) as any}>{sub.riskLevel} risk</Badge>
                </div>
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
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {sub.flags.map((f, j) => (
                    <Badge key={j} variant="outline" className="text-xs">{f}</Badge>
                  ))}
                </div>
                <Select
                  value={sub.reviewDecision || ""}
                  onValueChange={(val) => saveReviewDecision(sub.submissionId, val, i)}
                >
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue placeholder="Review action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clear">Clear</SelectItem>
                    <SelectItem value="investigate">Investigate</SelectItem>
                    <SelectItem value="misconduct-concern">Misconduct Concern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcademicIntegrity;
