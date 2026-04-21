import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Bot,
  Eye,
  FileSearch,
  Loader2,
  Scale,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { safeFormatDate } from "@/lib/date";
import type { Tables } from "@/integrations/supabase/types";
import {
  type IntegrityDecision,
  type IntegrityEvidenceItem,
  type IntegrityHistoryEntry,
  parseStoredReviewPayload,
  serializeReviewPayload,
} from "@/lib/integrityReviews";

interface OverviewStat {
  label: string;
  value: string;
  icon: React.ElementType;
}

interface FlaggedCase {
  submissionId: string;
  assignmentId: string;
  student: string;
  assignment: string;
  status: string;
  submittedAt: string;
  riskLevel: "high" | "medium" | "low";
  analysisLimited: boolean;
  limitations: string[];
  totalScore: number;
  aiWritingScore: number;
  similarityScore: number;
  overlapBreakdown: {
    totalOverlap: number;
    citedOverlap: number;
    uncitedOverlap: number;
    internalPeerOverlap: number;
    externalSourceOverlap: number;
  };
  baselineDeviationScore: number;
  evidence: {
    aiWriting: IntegrityEvidenceItem[];
    similarity: IntegrityEvidenceItem[];
    uncitedMatches: IntegrityEvidenceItem[];
    citedMatches: IntegrityEvidenceItem[];
    peerMatches: IntegrityEvidenceItem[];
    externalMatches: IntegrityEvidenceItem[];
    baselineDeviation: IntegrityEvidenceItem[];
  };
  flags: string[];
  decision: IntegrityDecision;
  history: IntegrityHistoryEntry[];
}

const isEvidenceItem = (value: unknown): value is IntegrityEvidenceItem =>
  !!value &&
  typeof value === "object" &&
  "label" in value &&
  "value" in value &&
  "score" in value;

const ensureEvidenceList = (value: unknown): IntegrityEvidenceItem[] =>
  Array.isArray(value) ? value.filter(isEvidenceItem) : [];

const ensureStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];

const MetricBar = ({ value }: { value: number }) => (
  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
    <div
      className="h-full rounded-full bg-primary transition-all"
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

type StoredIntegrityReview = Tables<"academic_integrity_reviews">;
type SubmissionRow = Pick<
  Tables<"submissions">,
  "id" | "assignment_id" | "student_name" | "student_email" | "status" | "submitted_at"
>;

const decisionOptions: IntegrityDecision[] = [
  "pending",
  "clear",
  "investigate",
  "misconduct-concern",
];

const normalizeDecision = (value: unknown): IntegrityDecision =>
  value === "clear" || value === "investigate" || value === "misconduct-concern" || value === "pending"
    ? value
    : "pending";

const getReviewType = (item: Pick<FlaggedCase, "aiWritingScore" | "similarityScore" | "baselineDeviationScore">) => {
  if (item.aiWritingScore > 0 && item.similarityScore > 0) return "mixed";
  if (item.aiWritingScore > 0) return "ai-writing-suspicion";
  if (item.baselineDeviationScore > 0 && item.similarityScore === 0) return "baseline-deviation";
  return "similarity-plagiarism-suspicion";
};

const AcademicIntegrity = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<OverviewStat[]>([]);
  const [flagged, setFlagged] = useState<FlaggedCase[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, IntegrityDecision>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

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

        const submissions = (submissionsData || []) as SubmissionRow[];
        const submissionMap = new Map(submissions.map((submission) => [submission.id, submission]));

        const { data: storedReviews, error: reviewsError } = await supabase
          .from("academic_integrity_reviews")
          .select("submission_id, decision, evidence_summary, lecturer_note, updated_at")
          .eq("lecturer_id", user.id)
          .in("submission_id", submissions.map((submission) => submission.id));

        if (reviewsError) throw reviewsError;

        const cases: FlaggedCase[] = (storedReviews || [])
          .map((review) => {
            const submission = submissionMap.get(review.submission_id);
            if (!submission) return null;

            const payload = parseStoredReviewPayload(
              review as Pick<StoredIntegrityReview, "lecturer_note" | "updated_at" | "decision">
            );
            const snapshot = payload.integritySnapshot;

            if (!snapshot && payload.history.length === 0 && review.decision === "pending") {
              return null;
            }

            return {
              submissionId: submission.id,
              assignmentId: submission.assignment_id,
              student: submission.student_name || submission.student_email || "Student",
              assignment: assignmentMap.get(submission.assignment_id) || "Unknown assignment",
              status: submission.status,
              submittedAt: submission.submitted_at,
              riskLevel: snapshot?.riskLevel === "high" || snapshot?.riskLevel === "medium" || snapshot?.riskLevel === "low"
                ? snapshot.riskLevel
                : "low",
              analysisLimited: Boolean(snapshot?.analysisLimited),
              limitations: ensureStringList(snapshot?.limitations),
              totalScore: typeof snapshot?.totalScore === "number" ? snapshot.totalScore : 0,
              aiWritingScore: snapshot?.aiWritingScore || 0,
              similarityScore: snapshot?.similarityScore || 0,
              overlapBreakdown: snapshot?.overlapBreakdown || {
                totalOverlap: snapshot?.similarityScore || 0,
                citedOverlap: 0,
                uncitedOverlap: snapshot?.similarityScore || 0,
                internalPeerOverlap: snapshot?.similarityScore || 0,
                externalSourceOverlap: 0,
              },
              baselineDeviationScore: snapshot?.baselineDeviationScore || 0,
              evidence: {
                aiWriting: ensureEvidenceList(snapshot?.evidence?.aiWriting),
                similarity: ensureEvidenceList(snapshot?.evidence?.similarity),
                uncitedMatches: ensureEvidenceList(snapshot?.evidence?.uncitedMatches),
                citedMatches: ensureEvidenceList(snapshot?.evidence?.citedMatches),
                peerMatches: ensureEvidenceList(snapshot?.evidence?.peerMatches),
                externalMatches: ensureEvidenceList(snapshot?.evidence?.externalMatches),
                baselineDeviation: ensureEvidenceList(snapshot?.evidence?.baselineDeviation),
              },
              flags: ensureStringList(snapshot?.flags),
              decision: normalizeDecision(review.decision),
              history: payload.history,
            } satisfies FlaggedCase;
          })
          .filter((item): item is FlaggedCase => item !== null)
          .sort((left, right) => right.totalScore - left.totalScore);

        setDecisionDrafts(Object.fromEntries(cases.map((item) => [item.submissionId, item.decision])));
        setNoteDrafts(
          Object.fromEntries(
            cases.map((item) => [
              item.submissionId,
              item.history[0]?.note === "No note recorded." ? "" : item.history[0]?.note || "",
            ])
          )
        );

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
        toast.error("Could not load academic integrity cases.");
      }
      setLoading(false);
    };

    void fetchData();
  }, [user, user?.id]);

  const decisionVariant = (decision: IntegrityDecision) => {
    if (decision === "clear") return "default";
    if (decision === "misconduct-concern") return "destructive";
    if (decision === "investigate") return "secondary";
    return "outline";
  };

  const riskVariant = (level: FlaggedCase["riskLevel"]) =>
    level === "high" ? "destructive" : level === "medium" ? "secondary" : "outline";

  const riskLabel = (item: FlaggedCase) =>
    item.analysisLimited && item.riskLevel === "low" ? "analysis limited" : `${item.riskLevel} risk`;

  const saveDecision = async (item: FlaggedCase) => {
    if (!user) return;

    const nextDecision = decisionDrafts[item.submissionId] || "pending";
    const note = noteDrafts[item.submissionId]?.trim() || "";
    const nextEntry: IntegrityHistoryEntry = {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      decision: nextDecision,
      note: note || "No note recorded.",
    };
    const nextHistory = [nextEntry, ...item.history];
    const evidenceSummary = [
      ...item.evidence.aiWriting.map((entry) => `${entry.label}: ${entry.value}`),
      ...item.evidence.similarity.map((entry) => `${entry.label}: ${entry.value}`),
      ...item.evidence.uncitedMatches.map((entry) => `${entry.label}: ${entry.value}`),
      ...item.evidence.citedMatches.map((entry) => `${entry.label}: ${entry.value}`),
      ...item.evidence.peerMatches.map((entry) => `${entry.label}: ${entry.value}`),
      ...item.evidence.externalMatches.map((entry) => `${entry.label}: ${entry.value}`),
      ...item.evidence.baselineDeviation.map((entry) => `${entry.label}: ${entry.value}`),
    ]
      .slice(0, 8)
      .join("\n\n");

    setSavingId(item.submissionId);
    const { error } = await supabase.from("academic_integrity_reviews").upsert(
      {
        submission_id: item.submissionId,
        lecturer_id: user.id,
        review_type: getReviewType(item),
        decision: nextDecision,
        evidence_summary: evidenceSummary || null,
        lecturer_note: serializeReviewPayload(note, nextHistory, {
          totalScore: item.totalScore,
          aiWritingScore: item.aiWritingScore,
          similarityScore: item.similarityScore,
          overlapBreakdown: item.overlapBreakdown,
            baselineDeviationScore: item.baselineDeviationScore,
            riskLevel: item.riskLevel,
            analysisLimited: item.analysisLimited,
            limitations: item.limitations,
            evidence: item.evidence,
            flags: item.flags,
        }),
      },
      { onConflict: "submission_id,lecturer_id" }
    );
    setSavingId(null);

    if (error) {
      console.error("Failed to save academic integrity review:", error);
      toast.error("Could not save integrity review.");
      return;
    }

    setFlagged((current) =>
      current.map((entry) =>
        entry.submissionId === item.submissionId
          ? {
              ...entry,
              decision: nextDecision,
              history: nextHistory,
            }
          : entry
      )
    );
    setNoteDrafts((current) => ({ ...current, [item.submissionId]: "" }));
    toast.success("Integrity review saved.");
  };

  const totals = useMemo(() => {
    return {
      aiWriting: flagged.filter((item) => item.aiWritingScore >= 40).length,
      similarity: flagged.filter((item) => item.similarityScore >= 40).length,
      baselineDeviation: flagged.filter((item) => item.baselineDeviationScore >= 40).length,
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

  try {
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

      <div className="grid gap-4 md:grid-cols-4">
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
            <p className="text-xs text-muted-foreground">Writing baseline deviation</p>
            <p className="mt-2 text-2xl font-semibold">{totals.baselineDeviation}</p>
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
            Each case is attached to a stored integrity result, with evidence split between AI-writing signals and similarity/plagiarism signals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {flagged.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No persisted integrity cases found yet. Run a plagiarism check on an assignment to populate the queue.
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
                            {riskLabel(item)}
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
                        {item.analysisLimited && item.limitations.length > 0 && (
                          <p className="text-xs text-amber-700">
                            Analysis limited: {item.limitations.join(" ")}
                          </p>
                        )}
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

                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    {[
                      { label: "Overall case score", value: item.totalScore },
                      { label: "AI-writing suspicion", value: item.aiWritingScore },
                      { label: "Similarity suspicion", value: item.similarityScore },
                      { label: "Baseline deviation", value: item.baselineDeviationScore },
                    ].map((metric) => (
                      <div key={metric.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{metric.label}</span>
                          <span className="font-bold">{metric.value}%</span>
                        </div>
                        <MetricBar value={metric.value} />
                      </div>
                    ))}
                  </div>

                  {expanded && (
                    <div className="mt-4 space-y-4 rounded-xl border bg-muted/20 p-4">
                      <div className="grid gap-4 lg:grid-cols-4">
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

                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Scale className="h-4 w-4 text-primary" />
                            <p className="text-sm font-medium">Citation-aware overlap</p>
                          </div>
                          <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">Total {item.overlapBreakdown.totalOverlap}%</Badge>
                              <Badge variant="outline">Uncited {item.overlapBreakdown.uncitedOverlap}%</Badge>
                              <Badge variant="outline">Cited {item.overlapBreakdown.citedOverlap}%</Badge>
                              <Badge variant="outline">Peer {item.overlapBreakdown.internalPeerOverlap}%</Badge>
                              <Badge variant="outline">External {item.overlapBreakdown.externalSourceOverlap}%</Badge>
                            </div>
                          </div>
                          {[
                            { title: "Uncited matches", items: item.evidence.uncitedMatches },
                            { title: "Cited material", items: item.evidence.citedMatches },
                            { title: "Peer matches", items: item.evidence.peerMatches },
                            { title: "External matches", items: item.evidence.externalMatches },
                          ].map((group) => (
                            <div key={group.title} className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.title}</p>
                              {group.items.length === 0 ? (
                                <p className="text-sm text-muted-foreground">None recorded.</p>
                              ) : (
                                group.items.map((evidence) => (
                                  <div key={`${item.submissionId}-${group.title}-${evidence.label}`} className="rounded-lg border bg-background p-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-sm font-medium">{evidence.label}</p>
                                      <Badge variant="outline">{evidence.score}%</Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">{evidence.value}</p>
                                  </div>
                                ))
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" />
                            <p className="text-sm font-medium">Writing baseline evidence</p>
                          </div>
                          {item.evidence.baselineDeviation.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No strong baseline deviation recorded.</p>
                          ) : (
                            item.evidence.baselineDeviation.map((evidence) => (
                              <div key={`${item.submissionId}-${evidence.label}-baseline`} className="rounded-lg border bg-background p-3">
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
                          <Button onClick={() => void saveDecision(item)} disabled={savingId === item.submissionId}>
                            {savingId === item.submissionId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Save decision"
                            )}
                          </Button>
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
  } catch (error) {
    console.error("Academic integrity page render failed:", error);
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Academic integrity data could not be rendered cleanly. Reload the page or re-run the integrity check for the affected assignment.
        </CardContent>
      </Card>
    );
  }
};

export default AcademicIntegrity;
