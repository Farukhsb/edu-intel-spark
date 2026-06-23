import type { GradeRow, ModerationCaseRow, ModerationCaseView, ModerationNextStepSummary, ModerationReviewRow, SubmissionRow } from "@/lib/moderationWorkflowTypes";
import { getModerationReleaseState } from "@/lib/moderationWorkflowData";

interface ModerationActionPermissionInput {
  action: "agree" | "adjust" | "return" | "escalate" | "approve";
  moderationCase: ModerationCaseRow;
  userId: string | null | undefined;
}

interface ModerationDisagreementInput {
  moderationCase: ModerationCaseRow;
  grade: Pick<GradeRow, "lecturer_score" | "lecturer_feedback"> | null;
  latestModeratorReview: Pick<ModerationReviewRow, "action" | "proposed_score" | "proposed_feedback"> | null;
}

interface ModerationEscalationSummaryInput {
  moderationCase: ModerationCaseRow;
  disagreement: ReturnType<typeof getModerationDisagreementSummary>;
  latestModeratorReview: Pick<ModerationReviewRow, "notes"> | null;
}

interface ModerationNextStepInput {
  item: ModerationCaseView;
  userId: string | null | undefined;
}

const coerceSubmissionStatus = (value: string): SubmissionRow["status"] =>
  value as SubmissionRow["status"];

export const canPerformModerationAction = ({
  action,
  moderationCase,
  userId,
}: ModerationActionPermissionInput) => {
  if (!userId) return false;
  if (action === "approve") return moderationCase.lecturer_id === userId && moderationCase.status === "moderated";
  return moderationCase.moderator_id === userId;
};

export const getModerationDisagreementSummary = ({
  moderationCase,
  grade,
  latestModeratorReview,
}: ModerationDisagreementInput) => {
  const baselineScore = moderationCase.first_marker_score ?? grade?.lecturer_score ?? null;
  const moderatorScore =
    latestModeratorReview?.proposed_score ?? moderationCase.moderator_score ?? moderationCase.final_agreed_score ?? null;
  const baselineFeedback = grade?.lecturer_feedback?.trim() || null;
  const moderatorFeedback =
    latestModeratorReview?.proposed_feedback?.trim() || moderationCase.final_agreed_feedback?.trim() || null;

  const scoreChanged =
    typeof baselineScore === "number" &&
    typeof moderatorScore === "number" &&
    Math.abs(baselineScore - moderatorScore) >= 1;
  const feedbackChanged = Boolean(moderatorFeedback) && moderatorFeedback !== baselineFeedback;
  const hasMaterialChange = scoreChanged || feedbackChanged;
  let label = "Moderator confirmed the first marker decision.";

  if (scoreChanged && feedbackChanged) label = "Moderator changed both the score and feedback.";
  else if (scoreChanged) label = "Moderator changed the score.";
  else if (feedbackChanged) label = "Moderator changed the feedback.";

  return { hasMaterialChange, scoreChanged, feedbackChanged, baselineScore, moderatorScore, label };
};

export const getModerationEscalationSummary = ({
  moderationCase,
  disagreement,
  latestModeratorReview,
}: ModerationEscalationSummaryInput) => {
  const headline = disagreement.hasMaterialChange
    ? "Escalated after the moderator changed the outcome."
    : "Escalated without a material score or feedback change.";

  const resolutionState =
    "This case is still unresolved and needs owner or senior review before final approval.";

  const escalationReason = latestModeratorReview?.notes?.trim() || moderationCase.trigger_summary?.trim() || null;

  return { headline, resolutionState, escalationReason };
};

export const getModerationNextStep = ({ item, userId }: ModerationNextStepInput): ModerationNextStepSummary => {
  const submissionStatus = item.submission?.status ?? coerceSubmissionStatus(item.moderationCase.status);
  const releaseState = getModerationReleaseState({
    moderationCase: item.moderationCase,
    submissionStatus,
  });

  if (releaseState.tone === "released") {
    return {
      actor: "system",
      headline: "Released to student",
      detail: "The moderated outcome is already visible to the student. Use the audit trail for any follow-up.",
      tone: "resolved",
    };
  }

  if (item.moderationCase.status === "escalated" || submissionStatus === "escalated") {
    return {
      actor: "senior_review",
      headline: "Escalated dispute needs owner or senior review",
      detail:
        userId && item.moderationCase.lecturer_id === userId
          ? "Review the disagreement, decide whether to rework the mark, and only release after the dispute is closed."
          : "This case is blocked until the assignment owner or a senior reviewer resolves the dispute.",
      tone: "blocked",
    };
  }

  if (!item.moderationCase.moderator_id && item.moderationCase.status === "moderation_pending") {
    return {
      actor: "owner",
      headline: "Assign a moderator",
      detail: "Moderation cannot start until the assignment owner assigns this case to a moderator.",
      tone: "warning",
    };
  }

  if (item.moderationCase.status === "moderation_pending" || item.moderationCase.status === "moderation_in_progress") {
    if (userId && item.moderationCase.moderator_id === userId) {
      return {
        actor: "moderator",
        headline: "Complete the moderation decision",
        detail: "Compare the evidence, record the rationale, and either agree, adjust, return, or escalate the mark.",
        tone: "progress",
      };
    }

    return {
      actor: "moderator",
      headline: "Waiting for moderator review",
      detail: item.moderationCase.moderator_id
        ? "The assigned moderator still needs to complete the case before the owner can approve or release it."
        : "The case is queued for moderation but no moderator has accepted it yet.",
      tone: "progress",
    };
  }

  if (releaseState.tone === "approval") {
    return {
      actor: "owner",
      headline: "Assignment owner approval required",
      detail: "The moderator has finished. The assignment owner now needs to confirm the outcome before release.",
      tone: "warning",
    };
  }

  if (releaseState.tone === "ready") {
    return {
      actor: "owner",
      headline: "Release the approved outcome",
      detail: "Owner approval is complete. Open the assignment release workflow to publish the result to the student.",
      tone: "ready",
    };
  }

  return {
    actor: "system",
    headline: "Moderation follow-up required",
    detail: "Review the latest moderation state and continue the case from the moderation queue.",
    tone: "progress",
  };
};
