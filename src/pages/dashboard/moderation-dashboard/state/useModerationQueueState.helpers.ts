import { getLatestModeratorReview } from "@/lib/moderation";
import {
  canBulkApproveModeration,
  canBulkAssignModerator,
  getModerationDisagreementSummary,
  getModerationOwnerAssignmentSummaries,
  getModerationQueueStats,
  matchesModerationQueueFilter,
  matchesModerationQueueSearch,
  sortModerationQueueCases,
  type ModerationCaseView,
  type ModerationQueueFilter,
  type ModerationQueueSort,
} from "@/lib/moderationWorkflow";

export const getSelectedCase = (cases: ModerationCaseView[], selectedCaseId: string | null) =>
  cases.find((item) => item.moderationCase.id === selectedCaseId) ?? null;

export const getAssignmentFocusTitle = (
  assignmentFocusId: string | null,
  ownerAssignmentSummaries: Array<{ assignmentId: string; assignmentTitle: string }>,
  cases: ModerationCaseView[],
) =>
  assignmentFocusId
    ? ownerAssignmentSummaries.find((summary) => summary.assignmentId === assignmentFocusId)?.assignmentTitle ||
      cases.find((item) => (item.assignment?.id || item.moderationCase.assignment_id) === assignmentFocusId)?.assignment?.title ||
      "Assignment"
    : null;

export const getQueueFilterOptions = ({
  cases,
  userId,
}: {
  cases: ModerationCaseView[];
  userId: string | undefined;
}) =>
  [
    { value: "all" as const, label: "All cases" },
    { value: "assigned_to_me" as const, label: "Assigned to me" },
    { value: "awaiting_my_approval" as const, label: "Awaiting my approval" },
    { value: "escalated" as const, label: "Escalated" },
    { value: "ready_for_release" as const, label: "Ready for release" },
  ].map((option) => ({
    ...option,
    count: cases.filter((item) =>
      matchesModerationQueueFilter({
        item,
        filter: option.value,
        userId,
      }),
    ).length,
  }));

export const getFilteredCases = ({
  cases,
  assignmentFocusId,
  queueFilter,
  queueSearch,
  queueSort,
  userId,
}: {
  cases: ModerationCaseView[];
  assignmentFocusId: string | null;
  queueFilter: ModerationQueueFilter;
  queueSearch: string;
  queueSort: ModerationQueueSort;
  userId: string | undefined;
}) => {
  const visible = cases.filter(
    (item) =>
      (!assignmentFocusId || (item.assignment?.id || item.moderationCase.assignment_id) === assignmentFocusId) &&
      matchesModerationQueueFilter({
        item,
        filter: queueFilter,
        userId,
      }) &&
      matchesModerationQueueSearch({
        item,
        query: queueSearch,
      }),
  );

  return sortModerationQueueCases(visible, queueSort);
};

export const getSelectedBulkCases = (cases: ModerationCaseView[], selectedCaseIds: string[]) =>
  cases.filter((item) => selectedCaseIds.includes(item.moderationCase.id));

export const getSelectedBulkApprovalCases = (selectedBulkCases: ModerationCaseView[], userId: string | undefined) =>
  selectedBulkCases.filter((item) =>
    canBulkApproveModeration({
      item,
      userId,
    }),
  );

export const getBulkAssignableFilteredCases = (filteredCases: ModerationCaseView[], userId: string | undefined) =>
  filteredCases.filter((item) =>
    canBulkAssignModerator({
      item,
      userId,
    }),
  );

export const getBulkApprovableFilteredCases = (filteredCases: ModerationCaseView[], userId: string | undefined) =>
  filteredCases.filter((item) =>
    canBulkApproveModeration({
      item,
      userId,
    }),
  );

export const getSelectedBulkApprovalSummaries = (selectedBulkApprovalCases: ModerationCaseView[]) =>
  selectedBulkApprovalCases.map((item) => {
    const disagreement = getModerationDisagreementSummary({
      moderationCase: item.moderationCase,
      grade: item.grade,
      latestModeratorReview: getLatestModeratorReview(item.reviews),
    });

    return {
      caseId: item.moderationCase.id,
      studentLabel: item.submission?.student_name || item.submission?.student_email || "Student record unavailable",
      assignmentTitle: item.assignment?.title || "Assignment",
      disagreementLabel: disagreement.label,
      baselineScore: disagreement.baselineScore,
      moderatorScore: disagreement.moderatorScore,
      feedbackChanged: disagreement.feedbackChanged,
    };
  });

export const pruneSelectedCaseIds = (selectedCaseIds: string[], cases: ModerationCaseView[]) => {
  const knownIds = new Set(cases.map((item) => item.moderationCase.id));
  return selectedCaseIds.filter((id) => knownIds.has(id));
};

export const getQueueStats = (cases: ModerationCaseView[]) => getModerationQueueStats(cases);

export const getOwnerAssignmentSummaries = (cases: ModerationCaseView[], userId: string | undefined) =>
  getModerationOwnerAssignmentSummaries(cases, userId);
