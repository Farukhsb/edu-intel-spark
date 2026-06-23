import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { GradeRow, ModerationCaseRow, SubmissionRow } from "@/lib/moderationWorkflowTypes";
import type { ModerationAction } from "@/lib/moderation";

interface ModerationActionPlanInput {
  action: ModerationAction;
  moderationCase: ModerationCaseRow;
  submissionStatus: SubmissionRow["status"];
  grade: Pick<
    GradeRow,
    "ai_score" | "ai_feedback" | "lecturer_score" | "lecturer_feedback" | "final_score" | "final_feedback"
  > | null;
  userId: string;
  noteDraft: string;
  scoreDraft: string;
  feedbackDraft: string;
}

const getReviewerRole = (moderationCase: ModerationCaseRow, userId: string) => {
  if (moderationCase.first_marker_id === userId) return "first_marker";
  if (moderationCase.lecturer_id === userId) return "lecturer";
  return "moderator";
};

export const buildModerationActionPlan = ({
  action,
  moderationCase,
  submissionStatus,
  grade,
  userId,
  noteDraft,
  scoreDraft,
  feedbackDraft,
}: ModerationActionPlanInput) => {
  const resolvedScore =
    scoreDraft === ""
      ? moderationCase.final_agreed_score ??
        moderationCase.first_marker_score ??
        grade?.lecturer_score ??
        grade?.ai_score ??
        null
      : Number(scoreDraft);
  const resolvedFeedback =
    feedbackDraft || moderationCase.final_agreed_feedback || grade?.lecturer_feedback || grade?.ai_feedback || null;

  const nextCasePatch: Partial<TablesUpdate<"moderation_cases">> = {};
  let nextSubmissionStatus: SubmissionRow["status"] = submissionStatus;

  if (action === "agree" || action === "adjust") {
    nextCasePatch.status = "moderated";
    nextCasePatch.moderator_id = moderationCase.moderator_id ?? userId;
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

  const reviewPayload =
    action === "approve"
      ? null
      : ({
          moderation_case_id: moderationCase.id,
          submission_id: moderationCase.submission_id,
          reviewer_id: userId,
          reviewer_role: getReviewerRole(moderationCase, userId),
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
        } satisfies TablesInsert<"moderation_reviews">);

  return {
    resolvedScore,
    resolvedFeedback,
    nextCasePatch,
    nextSubmissionStatus,
    reviewPayload,
  };
};
