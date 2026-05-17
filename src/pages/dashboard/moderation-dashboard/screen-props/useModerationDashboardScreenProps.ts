import type { ModerationDashboardScreenProps } from "../ui";

type UseModerationDashboardScreenPropsArgs = {
  actions: {
    approveModerationBulk: () => Promise<void>;
    assignModerator: (item: ModerationDashboardScreenProps["selectedCase"]) => Promise<void>;
    assignModeratorBulk: () => Promise<void>;
    saveAction: (action: "agree" | "adjust" | "return" | "escalate" | "approve") => Promise<void>;
    saving: boolean;
    toggleSelectAllVisible: (checked: boolean) => void;
    toggleSelectedCase: (caseId: string, checked: boolean) => void;
  };
  openReleaseWorkflow: (assignmentId: string) => void;
  queueState: {
    assignmentFocusTitle: ModerationDashboardScreenProps["assignmentFocusTitle"];
    bulkApprovableFilteredCases: ModerationDashboardScreenProps["bulkApprovableFilteredCases"];
    bulkAssignableFilteredCases: ModerationDashboardScreenProps["bulkAssignableFilteredCases"];
    bulkModeratorId: ModerationDashboardScreenProps["bulkModeratorId"];
    feedbackDraft: ModerationDashboardScreenProps["feedbackDraft"];
    filteredCases: ModerationDashboardScreenProps["filteredCases"];
    lecturers: ModerationDashboardScreenProps["lecturers"];
    moderatorDrafts: ModerationDashboardScreenProps["moderatorDrafts"];
    noteDraft: ModerationDashboardScreenProps["noteDraft"];
    ownerAssignmentSummaries: ModerationDashboardScreenProps["ownerAssignmentSummaries"];
    queueFilter: ModerationDashboardScreenProps["queueFilter"];
    queueFilterOptions: ModerationDashboardScreenProps["queueFilterOptions"];
    queueSearch: ModerationDashboardScreenProps["queueSearch"];
    queueSort: ModerationDashboardScreenProps["queueSort"];
    queueStats: ModerationDashboardScreenProps["queueStats"];
    scoreDraft: ModerationDashboardScreenProps["scoreDraft"];
    selectedBulkApprovalSummaries: ModerationDashboardScreenProps["selectedBulkApprovalSummaries"];
    selectedCase: ModerationDashboardScreenProps["selectedCase"];
    selectedCaseIds: ModerationDashboardScreenProps["selectedCaseIds"];
    setAssignmentFocusId: ModerationDashboardScreenProps["onAssignmentFocusChange"];
    setBulkModeratorId: ModerationDashboardScreenProps["onBulkModeratorChange"];
    setFeedbackDraft: ModerationDashboardScreenProps["onFeedbackDraftChange"];
    setModeratorDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setNoteDraft: ModerationDashboardScreenProps["onNoteDraftChange"];
    setQueueFilter: ModerationDashboardScreenProps["onQueueFilterChange"];
    setQueueSearch: ModerationDashboardScreenProps["onQueueSearchChange"];
    setQueueSort: ModerationDashboardScreenProps["onQueueSortChange"];
    setScoreDraft: ModerationDashboardScreenProps["onScoreDraftChange"];
    setSelectedCaseId: ModerationDashboardScreenProps["onSelectCase"];
  };
  userId?: string;
};

export const useModerationDashboardScreenProps = ({
  actions,
  openReleaseWorkflow,
  queueState,
  userId,
}: UseModerationDashboardScreenPropsArgs): ModerationDashboardScreenProps => ({
  assignmentFocusTitle: queueState.assignmentFocusTitle,
  bulkApprovableFilteredCases: queueState.bulkApprovableFilteredCases,
  bulkAssignableFilteredCases: queueState.bulkAssignableFilteredCases,
  bulkModeratorId: queueState.bulkModeratorId,
  feedbackDraft: queueState.feedbackDraft,
  filteredCases: queueState.filteredCases,
  lecturers: queueState.lecturers,
  moderatorDrafts: queueState.moderatorDrafts,
  noteDraft: queueState.noteDraft,
  onAssignModerator: (item) => {
    if (item) void actions.assignModerator(item);
  },
  onAssignmentFocusChange: queueState.setAssignmentFocusId,
  onBulkApproveModeration: () => void actions.approveModerationBulk(),
  onBulkAssignModerator: () => void actions.assignModeratorBulk(),
  onBulkModeratorChange: queueState.setBulkModeratorId,
  onFeedbackDraftChange: queueState.setFeedbackDraft,
  onModeratorDraftChange: (caseId, value) =>
    queueState.setModeratorDrafts((current) => ({ ...current, [caseId]: value })),
  onNoteDraftChange: queueState.setNoteDraft,
  onOpenReleaseWorkflow: openReleaseWorkflow,
  onQueueFilterChange: queueState.setQueueFilter,
  onQueueSearchChange: queueState.setQueueSearch,
  onQueueSortChange: queueState.setQueueSort,
  onSaveAction: (action) => void actions.saveAction(action),
  onScoreDraftChange: queueState.setScoreDraft,
  onSelectCase: queueState.setSelectedCaseId,
  onToggleSelectAllVisible: actions.toggleSelectAllVisible,
  onToggleSelectedCase: actions.toggleSelectedCase,
  ownerAssignmentSummaries: queueState.ownerAssignmentSummaries,
  queueFilter: queueState.queueFilter,
  queueFilterOptions: queueState.queueFilterOptions,
  queueSearch: queueState.queueSearch,
  queueSort: queueState.queueSort,
  queueStats: queueState.queueStats,
  saving: actions.saving,
  scoreDraft: queueState.scoreDraft,
  selectedBulkApprovalSummaries: queueState.selectedBulkApprovalSummaries,
  selectedCase: queueState.selectedCase,
  selectedCaseIds: queueState.selectedCaseIds,
  userId,
});
