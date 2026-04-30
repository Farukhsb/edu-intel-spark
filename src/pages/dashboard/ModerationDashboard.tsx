import { useEffect, useMemo, useState } from "react";
import { ModerationQueueSummary } from "@/components/moderation/ModerationQueueSummary";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { log } from "@/lib/logger";
import {
  formatSubmissionStatus,
  getLatestModeratorReview,
  type ModerationAction,
} from "@/lib/moderation";
import {
  buildModerationActionPlan,
  buildModerationAuditPayload,
  fetchModerationCaseViews,
  getModerationQueueStats,
  insertModerationAuditEntry,
  type ModerationCaseView,
} from "@/lib/moderationWorkflow";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  ModerationQueueSection,
  ModerationReviewDialog,
} from "@/pages/dashboard/moderation-dashboard/sections";

type Submission = Tables<"submissions">;
type Grade = Tables<"grades">;
type Profile = Tables<"profiles">;

const actionLabel = (action: ModerationAction) => formatSubmissionStatus(action);

const DEMO_LECTURERS = [
  {
    id: "demo-lecturer",
    full_name: "Dr. Demo Lecturer",
    email: "demo@gradeai.com",
    role: "lecturer",
  },
  {
    id: "demo-moderator",
    full_name: "Prof. Maya Chen",
    email: "maya.chen@demo.gradeai.test",
    role: "lecturer",
  },
] as unknown as Profile[];

const DEMO_MODERATION_CASES = [
  {
    moderationCase: {
      id: "demo-moderation-case-1",
      submission_id: "demo-submission-1",
      assignment_id: "demo-assignment-policy-brief",
      grade_id: "demo-grade-1",
      lecturer_id: "demo-lecturer",
      first_marker_id: "demo-lecturer",
      moderator_id: "demo-moderator",
      status: "moderation_pending",
      trigger_flags: ["score_variance", "boundary_score"],
      trigger_summary: "AI and lecturer scores diverged near a classification boundary.",
      confidence_score: 0.64,
      integrity_risk_score: 18,
      ai_score_snapshot: 68,
      first_marker_score: 71,
      moderator_score: null,
      final_agreed_score: null,
      final_agreed_feedback: null,
      moderated_at: null,
      approved_at: null,
    },
    submission: {
      id: "demo-submission-1",
      student_name: "Amina Hassan",
      student_email: "amina.hassan@demo.gradeai.test",
      submitted_at: "2026-04-11T09:00:00.000Z",
      status: "moderation_pending",
    },
    grade: {
      id: "demo-grade-1",
      ai_score: 68,
      ai_feedback: "Strong evidence use, but the policy implementation section needs tighter evaluation.",
      lecturer_score: 71,
      lecturer_feedback: "Very good policy analysis with room to sharpen feasibility costing.",
      final_score: null,
      final_feedback: null,
      grading_confidence: 0.64,
      grading_metadata: null,
      ai_breakdown: null,
    },
    assignment: {
      id: "demo-assignment-policy-brief",
      title: "Strategic Policy Brief: Housing Affordability Interventions",
      max_score: 100,
    },
    firstMarker: DEMO_LECTURERS[0],
    moderator: DEMO_LECTURERS[1],
    integrityReview: null,
    reviews: [],
    auditLog: [],
  },
  {
    moderationCase: {
      id: "demo-moderation-case-2",
      submission_id: "demo-submission-2",
      assignment_id: "demo-assignment-ethics-review",
      grade_id: "demo-grade-2",
      lecturer_id: "demo-lecturer",
      first_marker_id: "demo-lecturer",
      moderator_id: "demo-moderator",
      status: "moderated",
      trigger_flags: ["integrity_risk"],
      trigger_summary: "Moderation retained because the integrity review required an independent second look.",
      confidence_score: 0.78,
      integrity_risk_score: 61,
      ai_score_snapshot: 61,
      first_marker_score: 63,
      moderator_score: 62,
      final_agreed_score: 62,
      final_agreed_feedback: "A solid upper-second response with clear ethics coverage and moderate scope for deeper critical analysis.",
      moderated_at: "2026-04-16T10:00:00.000Z",
      approved_at: null,
    },
    submission: {
      id: "demo-submission-2",
      student_name: "Daniel Reed",
      student_email: "daniel.reed@demo.gradeai.test",
      submitted_at: "2026-04-09T14:30:00.000Z",
      status: "moderated",
    },
    grade: {
      id: "demo-grade-2",
      ai_score: 61,
      ai_feedback: "Competent ethical analysis with limited depth on participant safeguarding.",
      lecturer_score: 63,
      lecturer_feedback: "Clear structure and secure knowledge, though the withdrawal procedure discussion could be stronger.",
      final_score: 62,
      final_feedback: "A secure upper-second piece with a clear line of argument and moderate room for deeper evaluative detail.",
      grading_confidence: 0.78,
      grading_metadata: null,
      ai_breakdown: null,
    },
    assignment: {
      id: "demo-assignment-ethics-review",
      title: "Research Ethics Review Memo",
      max_score: 100,
    },
    firstMarker: DEMO_LECTURERS[0],
    moderator: DEMO_LECTURERS[1],
    integrityReview: {
      decision: "investigate",
      lecturer_note: "Reviewed in demo moderation flow due to concentrated overlap in cited methods language.",
      updated_at: "2026-04-15T09:30:00.000Z",
    },
    reviews: [
      {
        id: "demo-review-1",
        moderation_case_id: "demo-moderation-case-2",
        submission_id: "demo-submission-2",
        reviewer_role: "moderator",
        action: "agree",
        proposed_score: 62,
        proposed_feedback: "A secure upper-second piece with a clear line of argument and moderate room for deeper evaluative detail.",
        notes: "Moderator agreed a slight downward adjustment from the first marker after reviewing the evidence.",
        created_at: "2026-04-16T10:00:00.000Z",
      },
    ],
    auditLog: [
      {
        id: "demo-audit-1",
        event_type: "moderation_agree",
        reason: "Demo moderation audit entry",
        created_at: "2026-04-16T10:00:00.000Z",
      },
    ],
  },
] as unknown as ModerationCaseView[];

const ModerationDashboard = () => {
  const { user, profile, isDemo } = useAuth();
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
    if (isDemo) {
      setLecturers(DEMO_LECTURERS);
      setCases(DEMO_MODERATION_CASES);
      setModeratorDrafts(
        Object.fromEntries(
          DEMO_MODERATION_CASES.map((item) => [item.moderationCase.id, item.moderationCase.moderator_id || "unassigned"]),
        ),
      );
      setLoading(false);
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      const { cases: caseViews, lecturers: lecturerRows } = await fetchModerationCaseViews(supabase);
      setLecturers(lecturerRows as Profile[]);
      setCases(caseViews);
      setModeratorDrafts(
        Object.fromEntries(
          caseViews.map((item) => [item.moderationCase.id, item.moderationCase.moderator_id || "unassigned"])
        )
      );
    } catch (error) {
      log.error("Failed to load moderation cases", error);
      toast.error("Moderation cases could not be loaded right now. Refresh the page or try again in a moment.");
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchCases();
  }, [isDemo, user?.id]);

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
    () => getModerationQueueStats(cases),
    [cases]
  );

  const insertAuditEntry = async (
    item: ModerationCaseView,
    eventType: string,
    previousValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
    reason: string
  ) => {
    if (!user) return;

    const { error } = await insertModerationAuditEntry(
      supabase,
      buildModerationAuditPayload({
        submissionId: item.submission.id,
        gradeId: item.grade?.id ?? item.moderationCase.grade_id,
        moderationCaseId: item.moderationCase.id,
        changedBy: user.id,
        eventType,
        actorRole: profile?.role ?? "lecturer",
        previousValues,
        newValues,
        reason,
      })
    );

    if (error) {
      log.warn("Failed to write moderation audit entry", {
        caseId: item.moderationCase.id,
      });
    }
  };

  const assignModerator = async (item: ModerationCaseView) => {
    if (isDemo) {
      const moderatorId = moderatorDrafts[item.moderationCase.id];
      setCases((current) =>
        current.map((entry) =>
          entry.moderationCase.id === item.moderationCase.id
            ? {
                ...entry,
                moderationCase: {
                  ...entry.moderationCase,
                  moderator_id: moderatorId,
                  status: "moderation_in_progress",
                },
                moderator: DEMO_LECTURERS.find((lecturer) => lecturer.id === moderatorId) || entry.moderator,
                submission: entry.submission
                  ? { ...entry.submission, status: "moderation_in_progress" }
                  : entry.submission,
              }
            : entry,
        ),
      );
      toast.success("Demo moderator assigned.");
      return;
    }

    if (!item.submission) {
      toast.error("This case is missing its linked submission details, so moderator assignment cannot continue.");
      return;
    }

    const moderatorId = moderatorDrafts[item.moderationCase.id];
    if (!moderatorId || moderatorId === "unassigned") {
      toast.error("Choose a moderator before saving this case.");
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
      log.error("Failed to assign moderator", error, {
        caseId,
        moderatorId,
      });
      toast.error("The moderator was not assigned. Try again, and check your access if this keeps happening.");
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
    if (isDemo) {
      if (!selectedCase) return;

      const nextSubmissionStatus =
        action === "approve"
          ? "approved"
          : action === "return"
            ? "first_review"
            : action === "escalate"
              ? "escalated"
              : "moderated";

      setCases((current) =>
        current.map((entry) => {
          if (entry.moderationCase.id !== selectedCase.moderationCase.id) return entry;

          const nextReview =
            action === "approve"
              ? entry.reviews
              : [
                  {
                    id: `demo-review-${Date.now()}`,
                    moderation_case_id: entry.moderationCase.id,
                    submission_id: entry.moderationCase.submission_id,
                    reviewer_role: entry.moderationCase.lecturer_id === user?.id ? "lecturer" : "moderator",
                    action,
                    proposed_score: scoreDraft === "" ? entry.moderationCase.final_agreed_score ?? entry.grade?.lecturer_score ?? entry.grade?.ai_score ?? null : Number(scoreDraft),
                    proposed_feedback: feedbackDraft || entry.moderationCase.final_agreed_feedback || entry.grade?.lecturer_feedback || entry.grade?.ai_feedback || null,
                    notes: noteDraft || null,
                    created_at: new Date().toISOString(),
                  } as any,
                  ...entry.reviews,
                ];

          return {
            ...entry,
            moderationCase: {
              ...entry.moderationCase,
              status:
                action === "approve"
                  ? entry.moderationCase.status
                  : action === "return"
                    ? "first_review"
                    : action === "escalate"
                      ? "escalated"
                      : "moderated",
              final_agreed_score:
                action === "return"
                  ? entry.moderationCase.final_agreed_score
                  : scoreDraft === ""
                    ? entry.moderationCase.final_agreed_score ?? entry.grade?.lecturer_score ?? entry.grade?.ai_score ?? null
                    : Number(scoreDraft),
              final_agreed_feedback:
                action === "return"
                  ? entry.moderationCase.final_agreed_feedback
                  : feedbackDraft || entry.moderationCase.final_agreed_feedback || entry.grade?.lecturer_feedback || entry.grade?.ai_feedback || null,
              moderator_score:
                action === "return"
                  ? entry.moderationCase.moderator_score
                  : scoreDraft === ""
                    ? entry.moderationCase.moderator_score ?? entry.grade?.lecturer_score ?? entry.grade?.ai_score ?? null
                    : Number(scoreDraft),
              moderated_at:
                action === "agree" || action === "adjust" ? new Date().toISOString() : entry.moderationCase.moderated_at,
              approved_at: action === "approve" ? new Date().toISOString() : entry.moderationCase.approved_at,
            },
            submission: entry.submission ? { ...entry.submission, status: nextSubmissionStatus } : entry.submission,
            grade:
              action === "approve" && entry.grade
                ? {
                    ...entry.grade,
                    final_score: scoreDraft === "" ? entry.grade.final_score ?? entry.grade.lecturer_score ?? entry.grade.ai_score ?? null : Number(scoreDraft),
                    final_feedback: feedbackDraft || entry.grade.final_feedback || entry.grade.lecturer_feedback || entry.grade.ai_feedback || null,
                  }
                : entry.grade,
            reviews: nextReview,
            auditLog: [
              {
                id: `demo-audit-${Date.now()}`,
                event_type: `moderation_${action}`,
                reason: noteDraft || `Demo moderation action recorded: ${action}.`,
                created_at: new Date().toISOString(),
              } as any,
              ...entry.auditLog,
            ],
          };
        }),
      );
      toast.success(`${actionLabel(action)} saved in demo mode.`);
      setSelectedCaseId(null);
      return;
    }

    if (!selectedCase || !user) return;
    if (!selectedCase.submission) {
      toast.error("This case is missing its linked submission details, so moderation actions are unavailable.");
      return;
    }

    const { moderationCase, submission, grade } = selectedCase;
    const resolvedScore =
      scoreDraft === ""
        ? moderationCase.final_agreed_score ?? moderationCase.first_marker_score ?? grade?.lecturer_score ?? grade?.ai_score ?? null
        : Number(scoreDraft);
    const resolvedFeedback =
      feedbackDraft || moderationCase.final_agreed_feedback || grade?.lecturer_feedback || grade?.ai_feedback || null;
    const isOwner = moderationCase.lecturer_id === user.id;

    if (action === "approve" && !isOwner) {
      toast.error("Only the assignment owner can approve the final moderated outcome. Ask the owning lecturer to complete approval.");
      return;
    }

    setSaving(true);
    try {
      const { resolvedScore, resolvedFeedback, nextCasePatch, nextSubmissionStatus, reviewPayload } =
        buildModerationActionPlan({
          action,
          moderationCase,
          submissionStatus: submission.status,
          grade,
          userId: user.id,
          noteDraft,
          scoreDraft,
          feedbackDraft,
        });

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

      if (reviewPayload) {
        const { error: reviewError } = await supabase.from("moderation_reviews").insert(reviewPayload);
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
      log.error("Failed to save moderation action", error, {
        caseId: selectedCaseId,
        action,
      });
      toast.error("The moderation action was not saved. Try again, and if it keeps failing check that you still have access to this case.");
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
      <ModerationQueueSummary queueStats={queueStats} />

      <ModerationQueueSection
        cases={cases}
        onSelectCase={setSelectedCaseId}
      />

      <ModerationReviewDialog
        feedbackDraft={feedbackDraft}
        lecturers={lecturers}
        moderatorDrafts={moderatorDrafts}
        noteDraft={noteDraft}
        onAssignModerator={(item) => void assignModerator(item)}
        onClose={() => setSelectedCaseId(null)}
        onFeedbackDraftChange={setFeedbackDraft}
        onModeratorDraftChange={(caseId, value) =>
          setModeratorDrafts((current) => ({ ...current, [caseId]: value }))
        }
        onNoteDraftChange={setNoteDraft}
        onSaveAction={(action) => void saveAction(action)}
        onScoreDraftChange={setScoreDraft}
        open={Boolean(selectedCase)}
        saving={saving}
        scoreDraft={scoreDraft}
        selectedCase={selectedCase}
        userId={user?.id}
      />
    </div>
  );
};

export default ModerationDashboard;
