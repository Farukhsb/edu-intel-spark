import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { log } from "@/lib/logger";
import { formatSubmissionStatus, type ModerationAction } from "@/lib/moderation";
import {
  buildModerationActionPlan,
  buildModerationAuditPayload,
  canBulkApproveModeration,
  canBulkAssignModerator,
  canPerformModerationAction,
  insertModerationAuditEntry,
  type ModerationCaseView,
} from "@/lib/moderationWorkflow";
import {
  createDemoGradeAuditLog,
  createDemoModerationReview,
  DEMO_LECTURERS,
} from "@/pages/dashboard/moderation-dashboard/demoData";
import { toast } from "sonner";

const actionLabel = (action: ModerationAction) => formatSubmissionStatus(action);
const asJson = (value: unknown): Json => value as Json;

type UseModerationActionsArgs = {
  bulkAssignableFilteredCases: ModerationCaseView[];
  bulkModeratorId: string;
  feedbackDraft: string;
  fetchCases: () => Promise<void>;
  isDemo: boolean;
  moderatorDrafts: Record<string, string>;
  noteDraft: string;
  profileRole: string | null | undefined;
  scoreDraft: string;
  selectedBulkApprovalCases: ModerationCaseView[];
  selectedBulkCases: ModerationCaseView[];
  selectedCase: ModerationCaseView | null;
  selectedCaseId: string | null;
  selectedCaseIds: string[];
  setCases: React.Dispatch<React.SetStateAction<ModerationCaseView[]>>;
  setSelectedCaseId: (value: string | null) => void;
  setSelectedCaseIds: React.Dispatch<React.SetStateAction<string[]>>;
  userId: string | undefined;
};

export const useModerationActions = ({
  bulkAssignableFilteredCases,
  bulkModeratorId,
  feedbackDraft,
  fetchCases,
  isDemo,
  moderatorDrafts,
  noteDraft,
  profileRole,
  scoreDraft,
  selectedBulkApprovalCases,
  selectedBulkCases,
  selectedCase,
  selectedCaseId,
  selectedCaseIds,
  setCases,
  setSelectedCaseId,
  setSelectedCaseIds,
  userId,
}: UseModerationActionsArgs) => {
  const [saving, setSaving] = useState(false);

  const insertAuditEntry = async (
    item: ModerationCaseView,
    eventType: string,
    previousValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
    reason: string,
  ) => {
    if (!userId || !item.submission) return;

    const { error } = await insertModerationAuditEntry(
      supabase,
      buildModerationAuditPayload({
        submissionId: item.submission.id,
        gradeId: item.grade?.id ?? item.moderationCase.grade_id,
        moderationCaseId: item.moderationCase.id,
        changedBy: userId,
        eventType,
        actorRole: profileRole ?? "lecturer",
        previousValues: asJson(previousValues),
        newValues: asJson(newValues),
        reason,
      }),
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
        caseId: item.moderationCase.id,
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
      "Moderator assigned to moderation case.",
    );

    toast.success("Moderator assigned.");
    setSaving(false);
    await fetchCases();
  };

  const toggleSelectedCase = (caseId: string, checked: boolean) => {
    setSelectedCaseIds((current) =>
      checked ? Array.from(new Set([...current, caseId])) : current.filter((id) => id !== caseId),
    );
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    const visibleIds = bulkAssignableFilteredCases.map((item) => item.moderationCase.id);
    setSelectedCaseIds((current) => {
      if (checked) return Array.from(new Set([...current, ...visibleIds]));
      return current.filter((id) => !visibleIds.includes(id));
    });
  };

  const assignModeratorBulk = async () => {
    if (!userId) return;
    if (!bulkModeratorId || bulkModeratorId === "unassigned") {
      toast.error("Choose a moderator before assigning the selected cases.");
      return;
    }

    const eligibleCases = selectedBulkCases.filter((item) =>
      canBulkAssignModerator({
        item,
        userId,
      }),
    );

    if (eligibleCases.length === 0) {
      toast.error("Select at least one moderation case that you own before assigning a moderator.");
      return;
    }

    if (isDemo) {
      setCases((current) =>
        current.map((entry) =>
          selectedCaseIds.includes(entry.moderationCase.id) &&
          canBulkAssignModerator({
            item: entry,
            userId,
          })
            ? {
                ...entry,
                moderationCase: {
                  ...entry.moderationCase,
                  moderator_id: bulkModeratorId,
                  status: "moderation_in_progress",
                },
                moderator: DEMO_LECTURERS.find((lecturer) => lecturer.id === bulkModeratorId) || entry.moderator,
                submission: entry.submission
                  ? { ...entry.submission, status: "moderation_in_progress" }
                  : entry.submission,
              }
            : entry,
        ),
      );
      setSelectedCaseIds([]);
      toast.success(`${eligibleCases.length} moderation case(s) assigned in demo mode.`);
      return;
    }

    setSaving(true);
    try {
      for (const item of eligibleCases) {
        const { error: caseError } = await supabase
          .from("moderation_cases")
          .update({
            moderator_id: bulkModeratorId,
            status: "moderation_in_progress",
          })
          .eq("id", item.moderationCase.id);
        if (caseError) throw caseError;

        const { error: submissionError } = await supabase
          .from("submissions")
          .update({ status: "moderation_in_progress" as const })
          .eq("id", item.submission!.id);
        if (submissionError) throw submissionError;

        await insertAuditEntry(
          item,
          "moderator_assigned",
          { moderator_id: item.moderationCase.moderator_id, status: item.moderationCase.status },
          { moderator_id: bulkModeratorId, status: "moderation_in_progress" },
          "Moderator assigned in bulk from the moderation queue.",
        );
      }

      setSelectedCaseIds([]);
      toast.success(`${eligibleCases.length} moderation case(s) assigned.`);
      await fetchCases();
    } catch (error) {
      log.error("Failed to bulk assign moderators", error, {
        selectedCaseIds,
        moderatorId: bulkModeratorId,
      });
      toast.error("Bulk moderator assignment failed. Try again, and confirm the selected cases still belong to you.");
    }
    setSaving(false);
  };

  const approveModerationBulk = async () => {
    if (!userId) return;

    const eligibleCases = selectedBulkApprovalCases;
    if (eligibleCases.length === 0) {
      toast.error("Select at least one moderated case that you own before bulk approval.");
      return;
    }

    if (isDemo) {
      setCases((current) =>
        current.map((entry) =>
          selectedCaseIds.includes(entry.moderationCase.id) &&
          canBulkApproveModeration({
            item: entry,
            userId,
          })
            ? {
                ...entry,
                moderationCase: {
                  ...entry.moderationCase,
                  approved_at: new Date().toISOString(),
                },
                submission: entry.submission ? { ...entry.submission, status: "approved" } : entry.submission,
                grade: entry.grade
                  ? {
                      ...entry.grade,
                      final_score:
                        entry.moderationCase.final_agreed_score ??
                        entry.grade.final_score ??
                        entry.grade.lecturer_score ??
                        entry.grade.ai_score ??
                        null,
                      final_feedback:
                        entry.moderationCase.final_agreed_feedback ??
                        entry.grade.final_feedback ??
                        entry.grade.lecturer_feedback ??
                        entry.grade.ai_feedback ??
                        null,
                    }
                  : entry.grade,
              }
            : entry,
        ),
      );
      setSelectedCaseIds([]);
      toast.success(`${eligibleCases.length} moderation case(s) approved in demo mode.`);
      return;
    }

    setSaving(true);
    try {
      for (const item of eligibleCases) {
        const resolvedScore =
          item.moderationCase.final_agreed_score ??
          item.moderationCase.first_marker_score ??
          item.grade?.lecturer_score ??
          item.grade?.ai_score ??
          null;
        const resolvedFeedback =
          item.moderationCase.final_agreed_feedback ??
          item.grade?.final_feedback ??
          item.grade?.lecturer_feedback ??
          item.grade?.ai_feedback ??
          null;

        const { error: caseError } = await supabase
          .from("moderation_cases")
          .update({ approved_at: new Date().toISOString() })
          .eq("id", item.moderationCase.id);
        if (caseError) throw caseError;

        const { error: submissionError } = await supabase
          .from("submissions")
          .update({ status: "approved" as const })
          .eq("id", item.submission!.id);
        if (submissionError) throw submissionError;

        const { error: gradeError } = await supabase
          .from("grades")
          .update({
            final_score: resolvedScore,
            final_feedback: resolvedFeedback,
            reviewed_by: userId,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", item.grade!.id);
        if (gradeError) throw gradeError;

        await insertAuditEntry(
          item,
          "moderation_approve",
          {
            case_status: item.moderationCase.status,
            submission_status: item.submission!.status,
            final_agreed_score: item.moderationCase.final_agreed_score,
          },
          {
            case_status: item.moderationCase.status,
            submission_status: "approved",
            final_agreed_score: item.moderationCase.final_agreed_score ?? resolvedScore,
          },
          "Moderated case approved in bulk from the moderation queue.",
        );
      }

      setSelectedCaseIds([]);
      toast.success(`${eligibleCases.length} moderation case(s) approved.`);
      await fetchCases();
    } catch (error) {
      log.error("Failed to bulk approve moderated cases", error, {
        selectedCaseIds,
      });
      toast.error("Bulk approval failed. Try again, and confirm the selected cases are still moderated and owned by you.");
    }
    setSaving(false);
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
                  createDemoModerationReview({
                    id: `demo-review-${Date.now()}`,
                    moderation_case_id: entry.moderationCase.id,
                    submission_id: entry.moderationCase.submission_id,
                    reviewer_role: entry.moderationCase.lecturer_id === userId ? "lecturer" : "moderator",
                    action,
                    proposed_score:
                      scoreDraft === ""
                        ? entry.moderationCase.final_agreed_score ??
                          entry.grade?.lecturer_score ??
                          entry.grade?.ai_score ??
                          null
                        : Number(scoreDraft),
                    proposed_feedback:
                      feedbackDraft ||
                      entry.moderationCase.final_agreed_feedback ||
                      entry.grade?.lecturer_feedback ||
                      entry.grade?.ai_feedback ||
                      null,
                    notes: noteDraft || null,
                    created_at: new Date().toISOString(),
                  }),
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
                    ? entry.moderationCase.final_agreed_score ??
                      entry.grade?.lecturer_score ??
                      entry.grade?.ai_score ??
                      null
                    : Number(scoreDraft),
              final_agreed_feedback:
                action === "return"
                  ? entry.moderationCase.final_agreed_feedback
                  : feedbackDraft ||
                    entry.moderationCase.final_agreed_feedback ||
                    entry.grade?.lecturer_feedback ||
                    entry.grade?.ai_feedback ||
                    null,
              moderator_score:
                action === "return"
                  ? entry.moderationCase.moderator_score
                  : scoreDraft === ""
                    ? entry.moderationCase.moderator_score ??
                      entry.grade?.lecturer_score ??
                      entry.grade?.ai_score ??
                      null
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
                    final_score:
                      scoreDraft === ""
                        ? entry.grade.final_score ?? entry.grade.lecturer_score ?? entry.grade.ai_score ?? null
                        : Number(scoreDraft),
                    final_feedback:
                      feedbackDraft ||
                      entry.grade.final_feedback ||
                      entry.grade.lecturer_feedback ||
                      entry.grade.ai_feedback ||
                      null,
                  }
                : entry.grade,
            reviews: nextReview,
            auditLog: [
              createDemoGradeAuditLog({
                id: `demo-audit-${Date.now()}`,
                event_type: `moderation_${action}`,
                reason: noteDraft || `Demo moderation action recorded: ${action}.`,
                created_at: new Date().toISOString(),
                submission_id: entry.moderationCase.submission_id,
              }),
              ...entry.auditLog,
            ],
          };
        }),
      );
      toast.success(`${actionLabel(action)} saved in demo mode.`);
      setSelectedCaseId(null);
      return;
    }

    if (!selectedCase || !userId) return;
    if (!selectedCase.submission) {
      toast.error("This case is missing its linked submission details, so moderation actions are unavailable.");
      return;
    }

    const { moderationCase, submission, grade } = selectedCase;
    const isOwner = moderationCase.lecturer_id === userId;

    if (action === "approve" && !isOwner) {
      toast.error("Only the assignment owner can approve the final moderated outcome. Ask the owning lecturer to complete approval.");
      return;
    }
    if (
      !canPerformModerationAction({
        action,
        moderationCase,
        userId,
      })
    ) {
      toast.error(
        action === "approve"
          ? "This case must be moderated before the owner can approve it."
          : "Only the assigned moderator can record this moderation action.",
      );
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
          userId,
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
            reviewed_by: userId,
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
        noteDraft || `Moderation action recorded: ${action}.`,
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

  return {
    approveModerationBulk,
    assignModerator,
    assignModeratorBulk,
    saveAction,
    saving,
    toggleSelectAllVisible,
    toggleSelectedCase,
  };
};
