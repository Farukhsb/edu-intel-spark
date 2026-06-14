import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { log } from "@/lib/logger";
import {
  buildModerationActionPlan,
  buildModerationAuditPayload,
  canBulkApproveModeration,
  canBulkAssignModerator,
  canPerformModerationAction,
  insertModerationAuditEntry,
  type ModerationCaseView,
} from "@/lib/moderationWorkflow";
import { toast } from "sonner";

import type { ModerationAction } from "@/lib/moderation";
import { actionLabel, asJson } from "./useModerationActions.helpers";

type UseModerationActionsArgs = {
  bulkAssignableFilteredCases: ModerationCaseView[];
  bulkModeratorId: string;
  feedbackDraft: string;
  fetchCases: () => Promise<void>;
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

export const useModerationActions = (args: UseModerationActionsArgs) => {
  const {
    bulkAssignableFilteredCases,
    bulkModeratorId,
    feedbackDraft,
    fetchCases,
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
  } = args;

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

  const assignModerator = async (item: ModerationCaseView | null) => {
    if (!item) return;

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
