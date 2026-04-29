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
import { log } from "@/lib/logger";
import type { Tables } from "@/integrations/supabase/types";
import {
  type IntegrityDecision,
} from "@/lib/integrityReviews";
import {
  type AcademicIntegrityOverviewStat,
  buildIntegrityCases,
  buildIntegrityDrafts,
  buildIntegrityOverview,
  buildIntegrityTotals,
  type FlaggedIntegrityCase,
  getIntegrityReviewType,
} from "@/lib/integrityQueue";
import { persistIntegrityDecision } from "@/lib/integrityDecisionPersistence";

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

type IntegrityQueueFilter = "pending" | "investigate" | "resolved";

const DEMO_INTEGRITY_CASES: FlaggedIntegrityCase[] = [
  {
    submissionId: "demo-submission-integrity-1",
    assignmentId: "demo-assignment-policy-brief",
    assignment: "Strategic Policy Brief: Housing Affordability Interventions",
    student: "Amina Hassan",
    submittedAt: "2026-04-11T09:00:00.000Z",
    status: "released",
    riskLevel: "medium",
    totalScore: 42,
    aiWritingScore: 38,
    similarityScore: 46,
    baselineDeviationScore: 31,
    flags: ["AI phrasing drift", "Moderate source overlap"],
    analysisLimited: false,
    limitations: [],
    decision: "pending",
    evidence: {
      aiWriting: [
        { label: "Stylistic variance", score: 41, value: "Sentence rhythm differs from earlier low-stakes writing samples." },
      ],
      similarity: [
        { label: "External overlap", score: 46, value: "Policy background phrasing partially overlaps with publicly available briefing material." },
      ],
      uncitedMatches: [
        { label: "Uncited overlap", score: 34, value: "A short policy-context paragraph should be paraphrased more clearly." },
      ],
      citedMatches: [
        { label: "Properly cited material", score: 12, value: "Quoted and referenced evidence has been separated from the flagged uncited overlap." },
      ],
      peerMatches: [],
      externalMatches: [
        { label: "External source match", score: 46, value: "Overlap detected against policy commentary websites, not internal peer work." },
      ],
      baselineDeviation: [
        { label: "Writing baseline", score: 31, value: "Register is more compressed and formal than prior drafts, but still plausibly student-authored." },
      ],
    },
    overlapBreakdown: {
      totalOverlap: 22,
      uncitedOverlap: 14,
      citedOverlap: 8,
      internalPeerOverlap: 0,
      externalSourceOverlap: 22,
    },
    history: [],
  },
  {
    submissionId: "demo-submission-integrity-2",
    assignmentId: "demo-assignment-ethics-review",
    assignment: "Research Ethics Review Memo",
    student: "Daniel Reed",
    submittedAt: "2026-04-09T14:30:00.000Z",
    status: "approved",
    riskLevel: "high",
    totalScore: 67,
    aiWritingScore: 58,
    similarityScore: 72,
    baselineDeviationScore: 49,
    flags: ["High uncited overlap", "Escalate for investigation"],
    analysisLimited: false,
    limitations: [],
    decision: "investigate",
    evidence: {
      aiWriting: [
        { label: "Register shift", score: 58, value: "The tone is markedly more polished than earlier in-course submissions." },
      ],
      similarity: [
        { label: "Uncited overlap cluster", score: 72, value: "Substantial uncited similarity appears in the methodology and governance sections." },
      ],
      uncitedMatches: [
        { label: "Methodology overlap", score: 72, value: "Multiple passages closely match open teaching materials without explicit attribution." },
      ],
      citedMatches: [],
      peerMatches: [],
      externalMatches: [
        { label: "External source overlap", score: 64, value: "Overlap appears against publicly indexed ethics-guidance examples." },
      ],
      baselineDeviation: [
        { label: "Baseline deviation", score: 49, value: "Baseline change is notable but secondary to the similarity evidence." },
      ],
    },
    overlapBreakdown: {
      totalOverlap: 35,
      uncitedOverlap: 28,
      citedOverlap: 7,
      internalPeerOverlap: 0,
      externalSourceOverlap: 35,
    },
    history: [
      {
        id: "demo-history-1",
        decision: "investigate",
        note: "Escalated in the demo workflow because uncited overlap is concentrated in core analytical sections.",
        createdAt: "2026-04-16T10:00:00.000Z",
      },
    ],
  },
];

const AcademicIntegrity = () => {
  const { user, isDemo } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<Array<AcademicIntegrityOverviewStat & { icon: React.ElementType }>>([]);
  const [flagged, setFlagged] = useState<FlaggedIntegrityCase[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, IntegrityDecision>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [queueFilter, setQueueFilter] = useState<IntegrityQueueFilter>("pending");

  useEffect(() => {
    if (isDemo) {
      const cases = DEMO_INTEGRITY_CASES;
      const drafts = buildIntegrityDrafts(cases);
      setOverview([
        ...buildIntegrityOverview({ submissionsScanned: 12, cases }).map((stat) => ({
          ...stat,
          icon:
            stat.label === "Submissions Scanned"
              ? FileSearch
              : stat.label === "Flagged for Review"
                ? AlertTriangle
                : stat.label === "Open Investigations"
                  ? Scale
                  : Shield,
        })),
      ]);
      setFlagged(cases);
      setDecisionDrafts(drafts.decisionDrafts);
      setNoteDrafts(drafts.noteDrafts);
      setLoading(false);
      return;
    }

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

        const { data: storedReviews, error: reviewsError } = await supabase
          .from("academic_integrity_reviews")
          .select("submission_id, decision, evidence_summary, lecturer_note, updated_at")
          .eq("lecturer_id", user.id)
          .in("submission_id", submissions.map((submission) => submission.id));

        if (reviewsError) throw reviewsError;

        const cases = buildIntegrityCases({
          reviews: (storedReviews || []) as Array<Pick<StoredIntegrityReview, "submission_id" | "decision" | "lecturer_note" | "updated_at">>,
          submissions,
          assignments: assignments.map((assignment) => ({ id: assignment.id, title: assignment.title })),
        });
        const drafts = buildIntegrityDrafts(cases);

        setOverview([
          ...buildIntegrityOverview({ submissionsScanned: submissions.length, cases }).map((stat) => ({
            ...stat,
            icon:
              stat.label === "Submissions Scanned"
                ? FileSearch
                : stat.label === "Flagged for Review"
                  ? AlertTriangle
                  : stat.label === "Open Investigations"
                    ? Scale
                    : Shield,
          })),
        ]);
        setFlagged(cases);
        setDecisionDrafts(drafts.decisionDrafts);
        setNoteDrafts(drafts.noteDrafts);
      } catch (error) {
        log.error("Failed to fetch integrity data", error);
        toast.error("Could not load academic integrity cases.");
      }
      setLoading(false);
    };

    void fetchData();
  }, [isDemo, user, user?.id]);

  const decisionVariant = (decision: IntegrityDecision) => {
    if (decision === "clear") return "default";
    if (decision === "misconduct-concern") return "destructive";
    if (decision === "investigate") return "secondary";
    return "outline";
  };

  const riskVariant = (level: FlaggedIntegrityCase["riskLevel"]) =>
    level === "high" ? "destructive" : level === "medium" ? "secondary" : "outline";

  const riskLabel = (item: FlaggedIntegrityCase) =>
    item.analysisLimited && item.riskLevel === "low" ? "analysis limited" : `${item.riskLevel} risk`;

  const saveDecision = async (item: FlaggedIntegrityCase) => {
    if (isDemo) {
      const nextDecision = decisionDrafts[item.submissionId] || "pending";
      const note = noteDrafts[item.submissionId]?.trim() || "";
      const historyEntry = {
        id: `demo-history-${Date.now()}`,
        decision: nextDecision,
        note: note || "Demo integrity review saved.",
        createdAt: new Date().toISOString(),
      };

      setFlagged((current) =>
        current.map((entry) =>
          entry.submissionId === item.submissionId
            ? {
                ...entry,
                decision: nextDecision,
                history: [historyEntry, ...entry.history],
              }
            : entry,
        ),
      );
      setNoteDrafts((current) => ({ ...current, [item.submissionId]: "" }));
      toast.success("Demo integrity review saved.");
      return;
    }

    if (!user) return;

    const nextDecision = decisionDrafts[item.submissionId] || "pending";
    const note = noteDrafts[item.submissionId]?.trim() || "";

    setSavingId(item.submissionId);
    const { error, nextHistory } = await persistIntegrityDecision({
      supabase,
      lecturerId: user.id,
      item,
      decision: nextDecision,
      note,
      reviewType: getIntegrityReviewType(item),
    });
    setSavingId(null);

    if (error) {
      log.error("Failed to save academic integrity review", error, {
        submissionId: item.submissionId,
      });
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

  const totals = useMemo(() => buildIntegrityTotals(flagged), [flagged]);
  const filteredCases = useMemo(() => {
    if (queueFilter === "pending") {
      return flagged.filter((item) => item.decision === "pending");
    }

    if (queueFilter === "investigate") {
      return flagged.filter((item) => item.decision === "investigate");
    }

    return flagged.filter(
      (item) => item.decision === "clear" || item.decision === "misconduct-concern"
    );
  }, [flagged, queueFilter]);

  const queueCounts = useMemo(
    () => ({
      pending: flagged.filter((item) => item.decision === "pending").length,
      investigate: flagged.filter((item) => item.decision === "investigate").length,
      resolved: flagged.filter(
        (item) => item.decision === "clear" || item.decision === "misconduct-concern"
      ).length,
    }),
    [flagged]
  );

  const queueEmptyMessage =
    queueFilter === "pending"
      ? "No pending integrity decisions right now."
      : queueFilter === "investigate"
        ? "No active investigations right now."
        : "No resolved integrity cases yet.";

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
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={queueFilter === "pending" ? "default" : "outline"}
              onClick={() => setQueueFilter("pending")}
            >
              Needs Review
              <Badge variant="secondary" className="ml-2">
                {queueCounts.pending}
              </Badge>
            </Button>
            <Button
              size="sm"
              variant={queueFilter === "investigate" ? "default" : "outline"}
              onClick={() => setQueueFilter("investigate")}
            >
              Active Investigations
              <Badge variant="secondary" className="ml-2">
                {queueCounts.investigate}
              </Badge>
            </Button>
            <Button
              size="sm"
              variant={queueFilter === "resolved" ? "default" : "outline"}
              onClick={() => setQueueFilter("resolved")}
            >
              Resolved
              <Badge variant="secondary" className="ml-2">
                {queueCounts.resolved}
              </Badge>
            </Button>
          </div>

          {flagged.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No persisted integrity cases found yet. Run a plagiarism check on an assignment to populate the queue.
            </p>
          ) : filteredCases.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {queueEmptyMessage}
            </p>
          ) : (
            filteredCases.map((item) => {
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
    log.error("Academic integrity page render failed", error);
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
