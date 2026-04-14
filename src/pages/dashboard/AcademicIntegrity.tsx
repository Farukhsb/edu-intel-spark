import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Eye,
  FileSearch,
  Loader2,
  Scale,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { safeFormatDate } from "@/lib/date";

interface OverviewStat {
  label: string;
  value: string;
  icon: React.ElementType;
}

type IntegrityDecision = "pending" | "clear" | "investigate" | "misconduct-concern";

interface IntegrityHistoryEntry {
  id: string;
  createdAt: string;
  decision: IntegrityDecision;
  note: string;
}

interface EvidenceItem {
  label: string;
  value: string;
  score: number;
}

interface FlaggedCase {
  submissionId: string;
  assignmentId: string;
  student: string;
  assignment: string;
  status: string;
  submittedAt: string;
  riskLevel: "high" | "medium" | "low";
  totalScore: number;
  aiWritingScore: number;
  similarityScore: number;
  evidence: {
    aiWriting: EvidenceItem[];
    similarity: EvidenceItem[];
  };
  flags: string[];
  decision: IntegrityDecision;
  history: IntegrityHistoryEntry[];
}

const decisionOptions: IntegrityDecision[] = [
  "pending",
  "clear",
  "investigate",
  "misconduct-concern",
];

const reviewStorageKey = "gradeai.integrityReviews";

const AcademicIntegrity = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<OverviewStat[]>([]);
  const [flagged, setFlagged] = useState<FlaggedCase[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, IntegrityDecision>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const loadStoredReviews = () => {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(reviewStorageKey);
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, { decision: IntegrityDecision; history: IntegrityHistoryEntry[] }>;
    } catch {
      return {};
    }
  };

  const persistStoredReviews = (
    next: Record<string, { decision: IntegrityDecision; history: IntegrityHistoryEntry[] }>
  ) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(reviewStorageKey, JSON.stringify(next));
    }
  };

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from("assignments")
          .select("id, title")
          .eq("lecturer_id", user.id);

        if (assignmentsError) throw assignmentsError;

        const assignments = assignmentsData || [];
        const assignmentIds = assignments.map((assignment) => assignment.id);
        const assignmentMap = new Map(assignments.map((assignment) => [assignment.id, assignment.title]));
        const storedReviews = loadStoredReviews();

        if (assignmentIds.length === 0) {
          setOverview([
            { label: "Submissions Scanned", value: "0", icon: FileSearch },
            { label: "Flagged for Review", value: "0", icon: AlertTriangle },
            { label: "Open Investigations", value: "0", icon: Scale },
            { label: "Cleared", value: "0", icon: Shield },
          ]);
          setFlagged([]);
          setLoading(false);
          return;
        }

        const { data: submissionsData, error: submissionsError } = await supabase
          .from("submissions")
          .select("id, assignment_id, student_name, student_email, status, submitted_at")
          .in("assignment_id", assignmentIds);

        if (submissionsError) throw submissionsError;

        const submissions = submissionsData || [];
        const submissionIds = submissions.map((submission) => submission.id);

        let gradesData: any[] = [];
        if (submissionIds.length > 0) {
          const { data: grades, error: gradesError } = await supabase
            .from("grades")
            .select("*")
            .in("submission_id", submissionIds);

          if (gradesError) throw gradesError;
          gradesData = grades || [];
        }

        const cases: FlaggedCase[] = [];

        gradesData.forEach((grade) => {
          const submission = submissions.find((item) => item.id === grade.submission_id);
          if (!submission) return;

          const breakdown = Array.isArray(grade.ai_breakdown) ? grade.ai_breakdown : [];
          const score = grade.final_score ?? grade.ai_score ?? 0;
          const studentName =
            submission.student_name || submission.student_email || `Student ${submission.id.slice(0, 6)}`;

          let aiWritingScore = 0;
          let similarityScore = 0;
          const aiWritingEvidence: EvidenceItem[] = [];
          const similarityEvidence: EvidenceItem[] = [];
          const flags: string[] = [];

          if (score > 95) {
            aiWritingScore += 20;
            aiWritingEvidence.push({
              label: "Assessment outcome",
              value: "Extremely high mark compared with normal review threshold",
              score: 20,
            });
            flags.push("Unusually high score");
          }

          if (breakdown.length > 0) {
            const ratios = breakdown.map((item: any) => {
              const maxScore = item.max_score ?? item.maxScore ?? 0;
              return maxScore > 0 ? (item.score ?? 0) / maxScore : 0;
            });
            const average = ratios.reduce((sum: number, ratio: number) => sum + ratio, 0) / ratios.length;
            const variance =
              ratios.length > 1
                ? ratios.reduce((sum: number, ratio: number) => sum + Math.pow(ratio - average, 2), 0) / ratios.length
                : 0;
            const perfectCount = ratios.filter((ratio: number) => ratio >= 0.95).length;

            if (variance < 0.01 && ratios.length > 2) {
              aiWritingScore += 35;
              aiWritingEvidence.push({
                label: "Rubric pattern",
                value: "Very uniform performance across criteria",
                score: 35,
              });
              flags.push("Uniform scores across criteria");
            }

            if (perfectCount >= Math.ceil(ratios.length * 0.8) && ratios.length > 2) {
              similarityScore += 25;
              similarityEvidence.push({
                label: "Rubric saturation",
                value: "Near-perfect rubric profile",
                score: 25,
              });
              flags.push("Near-perfect across most rubric criteria");
            }
          }

          if (typeof grade.ai_feedback === "string") {
            const feedback = grade.ai_feedback.toLowerCase();

            if (feedback.includes("ai-generated") || feedback.includes("machine-generated")) {
              aiWritingScore += 35;
              aiWritingEvidence.push({
                label: "AI grader language",
                value: "Feedback mentions possible AI-generated content",
                score: 35,
              });
              flags.push("AI grader mentioned AI-generated content");
            }

            if (feedback.includes("inconsistent style") || feedback.includes("style mismatch")) {
              aiWritingScore += 20;
              aiWritingEvidence.push({
                label: "Writing style",
                value: "Feedback flagged inconsistent writing style",
                score: 20,
              });
              flags.push("Writing style inconsistency detected");
            }

            if (feedback.includes("similar") || feedback.includes("copied") || feedback.includes("template")) {
              similarityScore += 20;
              similarityEvidence.push({
                label: "Similarity language",
                value: "Feedback hints at templated or copied structure",
                score: 20,
              });
              flags.push("Similarity/plagiarism style indicator");
            }
          }

          if (submission.status === "under_review") {
            similarityScore += 10;
            similarityEvidence.push({
              label: "Workflow state",
              value: "Submission already held in lecturer review",
              score: 10,
            });
          }

          const totalScore = Math.min(aiWritingScore + similarityScore, 100);
          if (totalScore < 35) return;

          const review = storedReviews[submission.id];
          const riskLevel: FlaggedCase["riskLevel"] =
            totalScore >= 80 ? "high" : totalScore >= 55 ? "medium" : "low";

          cases.push({
            submissionId: submission.id,
            assignmentId: submission.assignment_id,
            student: studentName,
            assignment: assignmentMap.get(submission.assignment_id) || "Unknown assignment",
            status: submission.status,
            submittedAt: submission.submitted_at,
            riskLevel,
            totalScore,
            aiWritingScore: Math.min(aiWritingScore, 100),
            similarityScore: Math.min(similarityScore, 100),
            evidence: {
              aiWriting: aiWritingEvidence,
              similarity: similarityEvidence,
            },
            flags,
            decision: review?.decision || "pending",
            history: review?.history || [],
          });
        });

        cases.sort((left, right) => right.totalScore - left.totalScore);

        setDecisionDrafts(
          Object.fromEntries(cases.map((item) => [item.submissionId, item.decision]))
        );
        setNoteDrafts(Object.fromEntries(cases.map((item) => [item.submissionId, ""])));

        const openInvestigations = cases.filter(
          (item) => item.decision === "investigate" || item.decision === "misconduct-concern"
        ).length;
        const cleared = cases.filter((item) => item.decision === "clear").length;

        setOverview([
          { label: "Submissions Scanned", value: submissions.length.toString(), icon: FileSearch },
          { label: "Flagged for Review", value: cases.length.toString(), icon: AlertTriangle },
          { label: "Open Investigations", value: openInvestigations.toString(), icon: Scale },
          { label: "Cleared", value: cleared.toString(), icon: Shield },
        ]);
        setFlagged(cases);
      } catch (error) {
        console.error("Failed to fetch integrity data:", error);
      }
      setLoading(false);
    };

    void fetchData();
  }, [user?.id]);

  const decisionVariant = (decision: IntegrityDecision) => {
    if (decision === "clear") return "default";
    if (decision === "misconduct-concern") return "destructive";
    if (decision === "investigate") return "secondary";
    return "outline";
  };

  const riskVariant = (level: FlaggedCase["riskLevel"]) =>
    level === "high" ? "destructive" : level === "medium" ? "secondary" : "outline";

  const saveDecision = (item: FlaggedCase) => {
    const nextDecision = decisionDrafts[item.submissionId] || "pending";
    const note = noteDrafts[item.submissionId]?.trim() || "";
    const historyEntry: IntegrityHistoryEntry = {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      decision: nextDecision,
      note: note || "No note recorded.",
    };

    const storedReviews = loadStoredReviews();
    storedReviews[item.submissionId] = {
      decision: nextDecision,
      history: [historyEntry, ...(storedReviews[item.submissionId]?.history || [])],
    };
    persistStoredReviews(storedReviews);

    setFlagged((current) =>
      current.map((entry) =>
        entry.submissionId === item.submissionId
          ? {
              ...entry,
              decision: nextDecision,
              history: [historyEntry, ...entry.history],
            }
          : entry
      )
    );
    setNoteDrafts((current) => ({ ...current, [item.submissionId]: "" }));
  };

  const totals = useMemo(() => {
    return {
      aiWriting: flagged.filter((item) => item.aiWritingScore >= 40).length,
      similarity: flagged.filter((item) => item.similarityScore >= 40).length,
      pending: flagged.filter((item) => item.decision === "pending").length,
    };
  }, [flagged]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">AI-writing suspicion</p>
            <p className="mt-2 text-2xl font-semibold">{totals.aiWriting}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Similarity/plagiarism suspicion</p>
            <p className="mt-2 text-2xl font-semibold">{totals.similarity}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending lecturer decisions</p>
            <p className="mt-2 text-2xl font-semibold">{totals.pending}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <CardTitle className="text-base">Academic Integrity Review Queue</CardTitle>
          </div>
          <CardDescription>
            Each case is attached to a real submission, with evidence split between AI-writing signals and similarity/plagiarism signals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {flagged.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No flagged submissions found in the current lecturer data.
            </p>
          ) : (
            flagged.map((item) => {
              const expanded = expandedId === item.submissionId;

              return (
                <div key={item.submissionId} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{item.student}</p>
                        <Badge variant={riskVariant(item.riskLevel) as "outline" | "secondary" | "destructive"}>
                          {item.riskLevel} risk
                        </Badge>
                        <Badge variant={decisionVariant(item.decision) as "outline" | "secondary" | "destructive" | "default"}>
                          {item.decision.replace("-", " ")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.assignment} • Submitted {safeFormatDate(item.submittedAt, "MMM d, yyyy HH:mm")} • Workflow {item.status.replace(/_/g, " ")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.flags.map((flag) => (
                          <Badge key={flag} variant="outline" className="text-xs">
                            {flag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/dashboard/assignments/${item.assignmentId}`)}
                      >
                        Open assignment
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setExpandedId((current) =>
                            current === item.submissionId ? null : item.submissionId
                          )
                        }
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        {expanded ? "Hide evidence" : "Review evidence"}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      { label: "Overall case score", value: item.totalScore },
                      { label: "AI-writing suspicion", value: item.aiWritingScore },
                      { label: "Similarity suspicion", value: item.similarityScore },
                    ].map((metric) => (
                      <div key={metric.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{metric.label}</span>
                          <span className="font-bold">{metric.value}%</span>
                        </div>
                        <Progress value={metric.value} className="h-1.5" />
                      </div>
                    ))}
                  </div>

                  {expanded && (
                    <div className="mt-4 space-y-4 rounded-xl border bg-muted/20 p-4">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-primary" />
                            <p className="text-sm font-medium">AI-writing suspicion evidence</p>
                          </div>
                          {item.evidence.aiWriting.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No strong AI-writing signals recorded.</p>
                          ) : (
                            item.evidence.aiWriting.map((evidence) => (
                              <div key={`${item.submissionId}-${evidence.label}`} className="rounded-lg border bg-background p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-medium">{evidence.label}</p>
                                  <Badge variant="outline">{evidence.score}%</Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">{evidence.value}</p>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <FileSearch className="h-4 w-4 text-primary" />
                            <p className="text-sm font-medium">Similarity / plagiarism evidence</p>
                          </div>
                          {item.evidence.similarity.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No strong similarity signals recorded.</p>
                          ) : (
                            item.evidence.similarity.map((evidence) => (
                              <div key={`${item.submissionId}-${evidence.label}`} className="rounded-lg border bg-background p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-medium">{evidence.label}</p>
                                  <Badge variant="outline">{evidence.score}%</Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">{evidence.value}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
                        <div className="space-y-2">
                          <Label>Review decision</Label>
                          <Select
                            value={decisionDrafts[item.submissionId] || item.decision}
                            onValueChange={(value: IntegrityDecision) =>
                              setDecisionDrafts((current) => ({ ...current, [item.submissionId]: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {decisionOptions.map((decision) => (
                                <SelectItem key={decision} value={decision}>
                                  {decision.replace("-", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Review note</Label>
                          <Textarea
                            rows={3}
                            value={noteDrafts[item.submissionId] || ""}
                            onChange={(event) =>
                              setNoteDrafts((current) => ({
                                ...current,
                                [item.submissionId]: event.target.value,
                              }))
                            }
                            placeholder="Explain why the case was cleared, escalated, or held for investigation."
                          />
                        </div>

                        <div className="flex items-end">
                          <Button onClick={() => saveDecision(item)}>Save decision</Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">Review history</p>
                        {item.history.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No review decisions recorded yet. Save a decision to start the audit trail.
                          </p>
                        ) : (
                          item.history.map((entry) => (
                            <div key={entry.id} className="rounded-lg border bg-background p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={decisionVariant(entry.decision) as "outline" | "secondary" | "destructive" | "default"}>
                                  {entry.decision.replace("-", " ")}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {safeFormatDate(entry.createdAt, "MMM d, yyyy HH:mm")}
                                </span>
                              </div>
                              <p className="mt-2 text-sm">{entry.note}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcademicIntegrity;
