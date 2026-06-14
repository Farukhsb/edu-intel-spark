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

import { buildDemoModeratorDrafts, DEMO_LECTURERS, DEMO_MODERATION_CASES } from "./demoData";
import type { ModerationProfile } from "./types";

export const buildDemoCases = () => DEMO_MODERATION_CASES.map((item) => ({ ...item }));

export const buildDemoLecturers = () => DEMO_LECTURERS.map((item) => ({ ...item })) as ModerationProfile[];

export const getDemoSelectedCase = (cases: ModerationCaseView[], selectedCaseId: string | null) =>
  cases.find((item) => item.moderationCase.id === selectedCaseId) ?? null;

export const getDemoAssignmentFocusTitle = (
  assignmentFocusId: string | null,
  ownerAssignmentSummaries: Array<{ assignmentId: string; assignmentTitle: string }>,
  cases: ModerationCaseView[],
) =>
  assignmentFocusId
    ? ownerAssignmentSummaries.find((summary) => summary.assignmentId === assignmentFocusId)?.assignmentTitle ||
      cases.find((item) => (item.assignment?.id || item.moderationCase.assignment_id) === assignmentFocusId)?.assignment?.title ||
      "Assignment"
    : null;

export const getDemoQueueFilterOptions = ({
  cases,
  userId,
}: {
  cases: ModerationCaseView[];
  userId: string;
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

export const getDemoFilteredCases = ({
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
  userId: string;
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

export const getDemoBulkAssignableFilteredCases = (filteredCases: ModerationCaseView[], userId: string) =>
  filteredCases.filter((item) =>
    canBulkAssignModerator({
      item,
      userId,
    }),
  );

export const getDemoBulkApprovableFilteredCases = (filteredCases: ModerationCaseView[], userId: string) =>
  filteredCases.filter((item) =>
    canBulkApproveModeration({
      item,
      userId,
    }),
  );

export const getDemoSelectedBulkCases = (cases: ModerationCaseView[], selectedCaseIds: string[]) =>
  cases.filter((item) => selectedCaseIds.includes(item.moderationCase.id));

export const getDemoSelectedBulkApprovalCases = (selectedBulkCases: ModerationCaseView[], userId: string) =>
  selectedBulkCases.filter((item) =>
    canBulkApproveModeration({
      item,
      userId,
    }),
  );

export const getDemoSelectedBulkApprovalSummaries = (selectedBulkApprovalCases: ModerationCaseView[]) =>
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

export const pruneDemoSelectedCaseIds = (selectedCaseIds: string[], cases: ModerationCaseView[]) => {
  const knownIds = new Set(cases.map((item) => item.moderationCase.id));
  return selectedCaseIds.filter((id) => knownIds.has(id));
};

export const getDemoQueueStats = (cases: ModerationCaseView[]) => getModerationQueueStats(cases);

export const getDemoOwnerAssignmentSummaries = (cases: ModerationCaseView[], userId: string) =>
  getModerationOwnerAssignmentSummaries(cases, userId);

export const buildDemoModeratorDraftMap = () => buildDemoModeratorDrafts(DEMO_MODERATION_CASES);
