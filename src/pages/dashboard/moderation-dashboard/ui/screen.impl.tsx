import { ModerationQueueSummary } from "@/components/moderation/ModerationQueueSummary";

import { ModerationQueueSection } from "./queue-section";
import { ModerationReviewDialog } from "./review-dialog";
import { buildSelectableCaseIds } from "./screen.helpers";
import type { ModerationDashboardScreenProps } from "./screen.types";

export const ModerationDashboardScreen = ({
  assignmentFocusTitle,
  bulkApprovableFilteredCases,
  bulkAssignableFilteredCases,
  bulkModeratorId,
  feedbackDraft,
  filteredCases,
  lecturers,
  moderatorDrafts,
  noteDraft,
  onAssignModerator,
  onAssignmentFocusChange,
  onBulkApproveModeration,
  onBulkAssignModerator,
  onBulkModeratorChange,
  onFeedbackDraftChange,
  onModeratorDraftChange,
  onNoteDraftChange,
  onOpenReleaseWorkflow,
  onQueueFilterChange,
  onQueueSearchChange,
  onQueueSortChange,
  onSaveAction,
  onScoreDraftChange,
  onSelectCase,
  onToggleSelectAllVisible,
  onToggleSelectedCase,
  ownerAssignmentSummaries,
  queueFilter,
  queueFilterOptions,
  queueSearch,
  queueSort,
  queueStats,
  saving,
  scoreDraft,
  selectedBulkApprovalSummaries,
  selectedCase,
  selectedCaseIds,
  userId,
}: ModerationDashboardScreenProps) => {
  const selectableCaseIds = buildSelectableCaseIds({
    bulkApprovableFilteredCases,
    bulkAssignableFilteredCases,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <ModerationQueueSummary
        queueStats={queueStats}
        ownerAssignmentSummaries={ownerAssignmentSummaries}
        onViewAssignmentCases={onAssignmentFocusChange}
        onFocusAssignmentQueue={(assignmentId, filter) => {
          onAssignmentFocusChange(assignmentId);
          onQueueFilterChange(filter);
        }}
        onOpenReleaseWorkflow={onOpenReleaseWorkflow}
      />

      <ModerationQueueSection
        cases={filteredCases}
        onSelectCase={(caseId) => onSelectCase(caseId)}
        queueFilter={queueFilter}
        queueFilterOptions={queueFilterOptions}
        onQueueFilterChange={onQueueFilterChange}
        queueSearch={queueSearch}
        onQueueSearchChange={onQueueSearchChange}
        queueSort={queueSort}
        onQueueSortChange={onQueueSortChange}
        assignmentFocusTitle={assignmentFocusTitle}
        onClearAssignmentFocus={() => onAssignmentFocusChange(null)}
        onOpenReleaseWorkflow={onOpenReleaseWorkflow}
        bulkModeratorId={bulkModeratorId}
        lecturers={lecturers}
        onBulkModeratorChange={onBulkModeratorChange}
        onBulkAssignModerator={onBulkAssignModerator}
        onToggleSelectAllVisible={onToggleSelectAllVisible}
        onToggleSelectedCase={onToggleSelectedCase}
        selectedCaseIds={selectedCaseIds}
        selectableCaseIds={selectableCaseIds}
        bulkAssignableCaseIds={bulkAssignableFilteredCases.map((item) => item.moderationCase.id)}
        bulkApprovableCaseIds={bulkApprovableFilteredCases.map((item) => item.moderationCase.id)}
        onBulkApproveModeration={onBulkApproveModeration}
        selectedBulkApprovalSummaries={selectedBulkApprovalSummaries}
        saving={saving}
        userId={userId}
      />

      <ModerationReviewDialog
        feedbackDraft={feedbackDraft}
        lecturers={lecturers}
        moderatorDrafts={moderatorDrafts}
        noteDraft={noteDraft}
        onAssignModerator={onAssignModerator}
        onClose={() => onSelectCase(null)}
        onFeedbackDraftChange={onFeedbackDraftChange}
        onModeratorDraftChange={onModeratorDraftChange}
        onNoteDraftChange={onNoteDraftChange}
        onSaveAction={onSaveAction}
        onScoreDraftChange={onScoreDraftChange}
        open={Boolean(selectedCase)}
        saving={saving}
        scoreDraft={scoreDraft}
        selectedCase={selectedCase}
        userId={userId}
      />
    </div>
  );
};
