import type { ModerationCaseView, ModerationQueueFilter, ModerationQueueSort, SubmissionRow } from "@/lib/moderationWorkflowTypes";
import { getModerationReleaseState } from "@/lib/moderationWorkflowData";

interface ModerationQueueFilterInput {
  item: ModerationCaseView;
  filter: ModerationQueueFilter;
  userId: string | null | undefined;
}

interface ModerationQueueSearchInput {
  item: ModerationCaseView;
  query: string;
}

interface ModerationBulkAssignEligibilityInput {
  item: ModerationCaseView;
  userId: string | null | undefined;
}

interface ModerationBulkApproveEligibilityInput {
  item: ModerationCaseView;
  userId: string | null | undefined;
}

const coerceSubmissionStatus = (value: string): SubmissionRow["status"] =>
  value as SubmissionRow["status"];

const getModerationPriorityRank = (item: ModerationCaseView) => {
  const releaseState = getModerationReleaseState({
    moderationCase: item.moderationCase,
    submissionStatus: item.submission?.status ?? coerceSubmissionStatus(item.moderationCase.status),
  });

  if (item.moderationCase.status === "escalated") return 0;
  if (releaseState.tone === "approval") return 1;
  if (releaseState.tone === "ready") return 2;
  if (item.moderationCase.status === "moderation_in_progress") return 3;
  if (item.moderationCase.status === "moderation_pending") return 4;
  if (releaseState.tone === "released") return 5;
  return 6;
};

export const matchesModerationQueueFilter = ({ item, filter, userId }: ModerationQueueFilterInput) => {
  if (filter === "all") return true;

  if (filter === "assigned_to_me") {
    return Boolean(userId) && item.moderationCase.moderator_id === userId;
  }

  if (filter === "awaiting_my_approval") {
    return (
      Boolean(userId) &&
      item.moderationCase.lecturer_id === userId &&
      getModerationReleaseState({
        moderationCase: item.moderationCase,
        submissionStatus: item.submission?.status ?? coerceSubmissionStatus(item.moderationCase.status),
      }).tone === "approval"
    );
  }

  if (filter === "escalated") {
    return item.moderationCase.status === "escalated" || item.submission?.status === "escalated";
  }

  if (filter === "ready_for_release") {
    return (
      getModerationReleaseState({
        moderationCase: item.moderationCase,
        submissionStatus: item.submission?.status ?? coerceSubmissionStatus(item.moderationCase.status),
      }).tone === "ready"
    );
  }

  return true;
};

export const matchesModerationQueueSearch = ({ item, query }: ModerationQueueSearchInput) => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;

  const haystack = [
    item.submission?.student_name,
    item.submission?.student_email,
    item.assignment?.title,
    item.moderator?.full_name,
    item.firstMarker?.full_name,
    item.moderationCase.status,
    item.submission?.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(trimmed);
};

export const sortModerationQueueCases = (items: ModerationCaseView[], sort: ModerationQueueSort) => {
  return [...items].sort((left, right) => {
    if (sort === "student") {
      const leftName = left.submission?.student_name || left.submission?.student_email || "";
      const rightName = right.submission?.student_name || right.submission?.student_email || "";
      return leftName.localeCompare(rightName);
    }

    if (sort === "newest") {
      const leftTime = new Date(left.moderationCase.updated_at).getTime();
      const rightTime = new Date(right.moderationCase.updated_at).getTime();
      return rightTime - leftTime;
    }

    const rankDelta = getModerationPriorityRank(left) - getModerationPriorityRank(right);
    if (rankDelta !== 0) return rankDelta;

    const leftTime = new Date(left.moderationCase.updated_at).getTime();
    const rightTime = new Date(right.moderationCase.updated_at).getTime();
    return rightTime - leftTime;
  });
};

export const canBulkAssignModerator = ({ item, userId }: ModerationBulkAssignEligibilityInput) => {
  if (!userId || !item.submission) return false;
  return (
    item.moderationCase.lecturer_id === userId &&
    (item.moderationCase.status === "moderation_pending" ||
      item.moderationCase.status === "moderation_in_progress")
  );
};

export const canBulkApproveModeration = ({ item, userId }: ModerationBulkApproveEligibilityInput) => {
  if (!userId || !item.submission || !item.grade) return false;
  return item.moderationCase.lecturer_id === userId && item.moderationCase.status === "moderated" && item.submission.status === "moderated";
};
