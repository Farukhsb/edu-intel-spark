import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { safeFormatDate } from "@/lib/date";
import {
  evaluateModerationSignals,
  formatSubmissionStatus,
  getLatestModeratorReview,
  type ModerationAction,
} from "@/lib/moderation";
import { Loader2, Shield, Scale, CheckCheck, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";

type ModerationCase = Tables<"moderation_cases">;
type Submission = Tables<"submissions">;
type Grade = Tables<"grades">;
type Assignment = Tables<"assignments">;
type ModerationReview = Tables<"moderation_reviews">;
type GradeAudit = Tables<"grade_audit_log">;
type Profile = Tables<"profiles">;
type IntegrityReview = Tables<"academic_integrity_reviews">;

interface ModerationCaseView {
  moderationCase: ModerationCase;
  submission: Submission;
  grade: Grade | null;
  assignment: Assignment | null;
  firstMarker: Profile | null;
  moderator: Profile | null;
  integrityReview: IntegrityReview | null;
  reviews: ModerationReview[];
  auditLog: GradeAudit[];
}

const actionLabel = (action: ModerationAction) => formatSubmissionStatus(action);

const ModerationDashboard = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cases, setCases] = useState<ModerationCaseView[]>([]);
  const [lecturers, setLecturers] = useState<Profile[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [scoreDraft, setScoreDraft] = useState("");
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [moderatorDrafts, setModeratorDrafts] = useState<Record<string, string>>({});

  const selectedCase = useMemo(
    () => cases.find((item) => item.moderationCase.id === selectedCaseId) ?? null,
    [cases, selectedCaseId]
  );

  const fetchCases = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [{ data: moderationCaseRows, error: caseError }, { data: lecturerRows, error: lecturerError }] =
        await Promise.all([
          supabase.from("moderation_cases").select("*").order("updated_at", { ascending: false }),
          supabase.from("profiles").select("*").eq("role", "lecturer"),
        ]);

      if (caseError) throw caseError;
      if (lecturerError) throw lecturerError;

      const moderationCases = moderationCaseRows || [];
      setLecturers((lecturerRows || []) as Profile[]);

      if (moderationCases.length === 0) {
        setCases([]);
        setLoading(false);
        return;
      }

      const submissionIds = moderationCases.map((item) => item.submission_id);
      const assignmentIds = Array.from(new Set(moderationCases.map((item) => item.assignment_id)));
      const gradeIds = moderationCases.map((item) => item.grade_id).filter(Boolean) as string[];
      const profileIds = Array.from(
        new Set(
          moderationCases.flatMap((item) => [item.first_marker_id, item.moderator_id].filter(Boolean) as string[])
        )
      );
      const caseIds = moderationCases.map((item) => item.id);

      const [
        { data: submissionRows },
        { data: assignmentRows },
        { data: gradeRows },
        { data: profileRows },
        { data: integrityRows },
        { data: reviewRows },
        { data: auditRows },
      ] = await Promise.all([
        supabase.from("submissions").select("*").in("id", submissionIds),
        supabase.from("assignments").select("*").in("id", assignmentIds),
        gradeIds.length > 0 ? supabase.from("grades").select("*").in("id", gradeIds) : Promise.resolve({ data: [] }),
        profileIds.length > 0 ? supabase.from("profiles").select("*").in("id", profileIds) : Promise.resolve({ data: [] }),
        supabase.from("academic_integrity_reviews").select("*").in("submission_id", submissionIds),
        supabase.from("moderation_reviews").select("*").in("moderation_case_id", caseIds).order("created_at", { ascending: false }),
        supabase.from("grade_audit_log").select("*").in("submission_id", submissionIds).order("created_at", { ascending: false }),
      ]);

      const submissionsById = new Map((submissionRows || []).map((row) => [row.id, row]));
      const assignmentsById = new Map((assignmentRows || []).map((row) => [row.id, row]));
      const gradesById = new Map((gradeRows || []).map((row) => [row.id, row]));
      const profilesById = new Map((profileRows || []).map((row) => [row.id, row]));
      const integrityBySubmission = new Map((integrityRows || []).map((row) => [row.submission_id, row]));
      const reviewsByCase = new Map<string, ModerationReview[]>();
      for (const review of reviewRows || []) {
        const current = reviewsByCase.get(review.moderation_case_id) || [];
        current.push(review);
        reviewsByCase.set(review.moderation_case_id, current);
      }
      const auditBySubmission = new Map<string, GradeAudit[]>();
      for (const entry of auditRows || []) {
        const current = auditBySubmission.get(entry.submission_id) || [];
        current.push(entry);
        auditBySubmission.set(entry.submission_id, current);
      }

      const caseViews: ModerationCaseView[] = moderationCases
        .map((moderationCase) => {
          const submission = submissionsById.get(moderationCase.submission_id);
          if (!submission) return null;

          return {
            moderationCase,
            submission,
            grade: moderationCase.grade_id ? gradesById.get(moderationCase.grade_id) || null : null,
            assignment: assignmentsById.get(moderationCase.assignment_id) || null,
            firstMarker: moderationCase.first_marker_id ? profilesById.get(moderationCase.first_marker_id) || null : null,
            moderator: moderationCase.moderator_id ? profilesById.get(moderationCase.moderator_id) || null : null,
            integrityReview: integrityBySubmission.get(moderationCase.submission_id) || null,
            reviews: reviewsByCase.get(moderationCase.id) || [],
            auditLog: auditBySubmission.get(moderationCase.submission_id) || [],
          } satisfies ModerationCaseView;
        })
        .filter((item): item is ModerationCaseView => item !== null);

      setCases(caseViews);
      setModeratorDrafts(
        Object.fromEntries(
          caseViews.map((item) => [item.moderationCase.id, item.moderationCase.moderator_id || "unassigned"])
        )
      );
    } catch (error) {
      console.error("Failed to load moderation cases:", error);
      toast.error("Could not load moderation cases.");
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchCases();
  }, [user?.id]);

  useEffect(() => {
    if (!selectedCase) return;
    const latestModeratorReview = getLatestModeratorReview(selectedCase.reviews);
    setNoteDraft(latestModeratorReview?.notes || "");
    setScoreDraft(
      latestModeratorReview?.proposed_score?.toString() ??
        selectedCase.moderationCase.final_agreed_score?.toString() ??
        selectedCase.moderationCase.first_marker_score?.toString() ??
        ""
    );
    setFeedbackDraft(
      latestModeratorReview?.proposed_feedback ||
        selectedCase.moderationCase.final_agreed_feedback ||
        selectedCase.grade?.lecturer_feedback ||
        ""
    );
  }, [selectedCase]);

  const queueStats = useMemo(
    () => ({
      pending: cases.filter((item) => item.moderationCase.status === "moderation_pending").length,
      inProgress: cases.filter((item) => item.moderationCase.status === "moderation_in_progress").length,
      moderated: cases.filter((item) => item.moderationCase.status === "moderated").length,
      escalated: cases.filter((item) => item.moderationCase.status === "escalated").length,
    }),
    [cases]
  );

  const insertAuditEntry = async (item: ModerationCaseView, eventType: string, previousValues: Record<string, unknown>, newValues: Record<string, unknown>, reason: string) => {
    if (!user) return;

    const { error } = await supabase.from("grade_audit_log").insert({
      submission_id: item.submission.id,
      grade_id: item.grade?.id ?? item.moderationCase.grade_id,
      moderation_case_id: item.moderationCase.id,
      changed_by: user.id,
      event_type: eventType,
      actor_role: profile?.role ?? "lecturer",
      previous_values: previousValues,
      new_values: newValues,
      reason,
    });

    if (error) {
      console.warn("Failed to write moderation audit entry:", error);
    }
  };

  const assignModerator = async (item: ModerationCaseView) => {
    const moderatorId = moderatorDrafts[item.moderationCase.id];
    if (!moderatorId || moderatorId === "unassigned") {
      toast.error("Select a moderator first.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("moderation_cases")
      .update({
        moderator_id: moderatorId,
        status: "moderation_in_progress",
      })
      .eq("id", item.moderationCase.id);

    if (error) {
      console.error("Failed to assign moderator:", error);
      toast.error("Could not assign moderator.");
      setSaving(false);
      return;
    }

    await supabase
      .from("submissions")
      .update({ status: "moderation_in_progress" as const })
      .eq("id", item.submission.id);

    await insertAuditEntry(
      item,
      "moderator_assigned",
      { moderator_id: item.moderationCase.moderator_id, status: item.moderationCase.status },
      { moderator_id: moderatorId, status: "moderation_in_progress" },
      "Moderator assigned to moderation case."
    );

    toast.success("Moderator assigned.");
    setSaving(false);
    await fetchCases();
  };

  const saveAction = async (action: ModerationAction) => {
    if (!selectedCase || !user) return;

    const { moderationCase, submission, grade } = selectedCase;
    const resolvedScore =
      scoreDraft === ""
        ? moderationCase.final_agreed_score ?? moderationCase.first_marker_score ?? grade?.lecturer_score ?? grade?.ai_score ?? null
        : Number(scoreDraft);
    const resolvedFeedback =
      feedbackDraft || moderationCase.final_agreed_feedback || grade?.lecturer_feedback || grade?.ai_feedback || null;
    const isOwner = moderationCase.lecturer_id === user.id;

    if (action === "approve" && !isOwner) {
      toast.error("Only the assignment lecturer can approve the moderated outcome.");
      return;
    }

    setSaving(true);
    try {
      const nextCasePatch: Partial<Tables<"moderation_cases">["Update"]> = {};
      let nextSubmissionStatus: Submission["status"] = submission.status;

      if (action === "agree" || action === "adjust") {
        nextCasePatch.status = "moderated";
        nextCasePatch.moderator_id = moderationCase.moderator_id ?? user.id;
        nextCasePatch.moderator_score = resolvedScore;
        nextCasePatch.final_agreed_score = resolvedScore;
        nextCasePatch.final_agreed_feedback = resolvedFeedback;
        nextCasePatch.moderated_at = new Date().toISOString();
        nextSubmissionStatus = "moderated";
      }

      if (action === "return") {
        nextCasePatch.status = "first_review";
        nextSubmissionStatus = "first_review";
      }

      if (action === "escalate") {
        nextCasePatch.status = "escalated";
        nextSubmissionStatus = "escalated";
      }

      if (action === "approve") {
        nextCasePatch.approved_at = new Date().toISOString();
        nextSubmissionStatus = "approved";
      }

      if (Object.keys(nextCasePatch).length > 0) {
        const { error: caseError } = await supabase.from("moderation_cases").update(nextCasePatch).eq("id", moderationCase.id);
        if (caseError) throw caseError;
      }

      const { error: submissionError } = await supabase
        .from("submissions")
        .update({ status: nextSubmissionStatus })
        .eq("id", submission.id);
      if (submissionError) throw submissionError;

      if (action === "approve" && grade) {
        const { error: gradeError } = await supabase
          .from("grades")
          .update({
            final_score: resolvedScore,
            final_feedback: resolvedFeedback,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", grade.id);
        if (gradeError) throw gradeError;
      }

      if (action !== "approve") {
        const reviewerRole =
          moderationCase.first_marker_id === user.id ? "first_marker" : moderationCase.lecturer_id === user.id ? "lecturer" : "moderator";
        const { error: reviewError } = await supabase.from("moderation_reviews").insert({
          moderation_case_id: moderationCase.id,
          submission_id: submission.id,
          reviewer_id: user.id,
          reviewer_role: reviewerRole,
          action,
          proposed_score: resolvedScore,
          proposed_feedback: resolvedFeedback,
          notes: noteDraft || null,
          snapshot: {
            ai_score: grade?.ai_score ?? null,
            first_marker_score: moderationCase.first_marker_score ?? grade?.lecturer_score ?? null,
            moderator_score: resolvedScore,
            status_before: moderationCase.status,
            status_after: nextSubmissionStatus,
          },
        });
        if (reviewError) throw reviewError;
      }

      await insertAuditEntry(
        selectedCase,
        `moderation_${action}`,
        {
          case_status: moderationCase.status,
          submission_status: submission.status,
          final_agreed_score: moderationCase.final_agreed_score,
        },
        {
          case_status: nextCasePatch.status ?? moderationCase.status,
          submission_status: nextSubmissionStatus,
          final_agreed_score:
            action === "approve"
              ? moderationCase.final_agreed_score ?? resolvedScore
              : nextCasePatch.final_agreed_score ?? moderationCase.final_agreed_score,
        },
        noteDraft || `Moderation action recorded: ${action}.`
      );

      toast.success(`${actionLabel(action)} saved.`);
      setSelectedCaseId(null);
      await fetchCases();
    } catch (error) {
      console.error("Failed to save moderation action:", error);
      toast.error("Could not save moderation action.");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Pending", value: queueStats.pending, icon: Clock },
          { label: "In Progress", value: queueStats.inProgress, icon: Shield },
          { label: "Moderated", value: queueStats.moderated, icon: CheckCheck },
          { label: "Escalated", value: queueStats.escalated, icon: AlertTriangle },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Moderation Queue</CardTitle>
          </div>
          <CardDescription>
            Moderation reuses the existing confidence, integrity, maths, and lecturer override signals. It does not auto-release final grades.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cases.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No moderation cases yet. Cases appear here when first review triggers moderation.
            </p>
          ) : (
            cases.map((item) => {
              const latestModeratorReview = getLatestModeratorReview(item.reviews);
              const moderationSignals = evaluateModerationSignals({
                grade: item.grade,
                integrityReview: item.integrityReview,
                maxScore: item.assignment?.max_score ?? 100,
              });

              return (
                <div key={item.moderationCase.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">
                          {item.submission.student_name || item.submission.student_email || "Student"}
                        </p>
                        <Badge variant="outline">{formatSubmissionStatus(item.moderationCase.status)}</Badge>
                        {item.moderationCase.integrity_risk_score != null && item.moderationCase.integrity_risk_score >= 55 && (
                          <Badge variant="secondary">Integrity risk {item.moderationCase.integrity_risk_score}%</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.assignment?.title || "Assignment"} • Submitted{" "}
                        {safeFormatDate(item.submission.submitted_at, "MMM d, yyyy HH:mm")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        First marker: {item.firstMarker?.full_name || "Unassigned"} • Moderator:{" "}
                        {item.moderator?.full_name || "Unassigned"}
                      </p>
                      {item.moderationCase.trigger_summary && (
                        <p className="text-xs text-muted-foreground">{item.moderationCase.trigger_summary}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {moderationSignals.signals.map((signal) => (
                          <Badge key={`${item.moderationCase.id}-${signal.code}`} variant="outline" className="text-xs">
                            {signal.label}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-right text-xs text-muted-foreground">
                        <p>AI {item.grade?.ai_score ?? "-"}</p>
                        <p>First marker {item.moderationCase.first_marker_score ?? item.grade?.lecturer_score ?? "-"}</p>
                        <p>Moderator {latestModeratorReview?.proposed_score ?? item.moderationCase.moderator_score ?? "-"}</p>
                        <p>Agreed {item.moderationCase.final_agreed_score ?? "-"}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setSelectedCaseId(item.moderationCase.id)}>
                        Review case
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedCase)} onOpenChange={(open) => !open && setSelectedCaseId(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Moderation Review</DialogTitle>
            <DialogDescription>
              {selectedCase?.submission.student_name || selectedCase?.submission.student_email || "Student"} •{" "}
              {selectedCase?.assignment?.title || "Assignment"}
            </DialogDescription>
          </DialogHeader>

          {selectedCase && (
            <div className="space-y-5 pt-2">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {[
                  { label: "AI score", value: selectedCase.grade?.ai_score ?? "-" },
                  { label: "First marker", value: selectedCase.moderationCase.first_marker_score ?? selectedCase.grade?.lecturer_score ?? "-" },
                  { label: "Moderator", value: getLatestModeratorReview(selectedCase.reviews)?.proposed_score ?? selectedCase.moderationCase.moderator_score ?? "-" },
                  { label: "Final agreed", value: selectedCase.moderationCase.final_agreed_score ?? "-" },
                  { label: "Confidence", value: selectedCase.moderationCase.confidence_score != null ? `${Math.round(selectedCase.moderationCase.confidence_score * 100)}%` : "-" },
                  { label: "Integrity risk", value: selectedCase.moderationCase.integrity_risk_score != null ? `${selectedCase.moderationCase.integrity_risk_score}%` : "-" },
                ].map((metric) => (
                  <Card key={metric.label}>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">{metric.label}</p>
                      <p className="mt-2 text-xl font-semibold">{metric.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                <Card>
                  <CardContent className="space-y-4 p-4">
                    <div className="space-y-2">
                      <Label>Assigned moderator</Label>
                      <Select
                        value={moderatorDrafts[selectedCase.moderationCase.id] || "unassigned"}
                        onValueChange={(value) =>
                          setModeratorDrafts((current) => ({ ...current, [selectedCase.moderationCase.id]: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {lecturers.map((lecturer) => (
                            <SelectItem key={lecturer.id} value={lecturer.id}>
                              {lecturer.full_name || lecturer.email || lecturer.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={saving || selectedCase.moderationCase.lecturer_id !== user?.id}
                      onClick={() => void assignModerator(selectedCase)}
                    >
                      Assign Moderator
                    </Button>
                    <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                      <p>Status: {formatSubmissionStatus(selectedCase.moderationCase.status)}</p>
                      <p className="mt-1">
                        Trigger flags: {(selectedCase.moderationCase.trigger_flags as string[]).join(", ") || "none"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-4 p-4">
                    <div className="space-y-2">
                      <Label>Moderation notes</Label>
                      <Textarea
                        rows={4}
                        value={noteDraft}
                        onChange={(event) => setNoteDraft(event.target.value)}
                        placeholder="Record the moderation rationale, comparison notes, and outcome."
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Moderator score</Label>
                        <Input
                          type="number"
                          value={scoreDraft}
                          onChange={(event) => setScoreDraft(event.target.value)}
                          placeholder={`Out of ${selectedCase.assignment?.max_score ?? 100}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Final agreed feedback</Label>
                        <Textarea
                          rows={3}
                          value={feedbackDraft}
                          onChange={(event) => setFeedbackDraft(event.target.value)}
                          placeholder="Feedback text to keep with the final agreed mark."
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" disabled={saving} onClick={() => void saveAction("agree")}>
                        Agree
                      </Button>
                      <Button variant="outline" disabled={saving} onClick={() => void saveAction("adjust")}>
                        Adjust
                      </Button>
                      <Button variant="outline" disabled={saving} onClick={() => void saveAction("return")}>
                        Return
                      </Button>
                      <Button variant="outline" disabled={saving} onClick={() => void saveAction("escalate")}>
                        Escalate
                      </Button>
                      <Button disabled={saving} onClick={() => void saveAction("approve")}>
                        Approve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Moderation History</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedCase.reviews.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No moderation actions recorded yet.</p>
                    ) : (
                      selectedCase.reviews.map((review) => (
                        <div key={review.id} className="rounded-lg border p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{actionLabel(review.action as ModerationAction)}</Badge>
                            <Badge variant="secondary">{formatSubmissionStatus(review.reviewer_role)}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {safeFormatDate(review.created_at, "MMM d, yyyy HH:mm")}
                            </span>
                          </div>
                          <p className="mt-2 text-sm">{review.notes || "No note recorded."}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Audit History</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedCase.auditLog.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No audit entries recorded yet.</p>
                    ) : (
                      selectedCase.auditLog.slice(0, 8).map((entry) => (
                        <div key={entry.id} className="rounded-lg border p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{formatSubmissionStatus(entry.event_type)}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {safeFormatDate(entry.created_at, "MMM d, yyyy HH:mm")}
                            </span>
                          </div>
                          {entry.reason && <p className="mt-2 text-sm">{entry.reason}</p>}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModerationDashboard;
