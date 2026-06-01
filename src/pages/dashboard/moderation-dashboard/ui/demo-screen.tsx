import { ModerationQueueSummary } from "@/components/moderation/ModerationQueueSummary";

import { ModerationQueueSection } from "./queue-section";
import { DemoModerationReviewDialog } from "./demo-review-dialog";
import type { ModerationCaseView, ModerationQueueFilter, ModerationQueueSort } from "@/lib/moderationWorkflow";
import type {
  ModerationBulkApprovalSummary,
  ModerationProfile,
} from "../types";

type ModerationDashboardScreenProps = {
  assignmentFocusTitle: string | null;
  bulkApprovableFilteredCases: ModerationCaseView[];
  bulkAssignableFilteredCases: ModerationCaseView[];
  bulkModeratorId: string;
  feedbackDraft: string;
  filteredCases: ModerationCaseView[];
  lecturers: ModerationProfile[];
  moderatorDrafts: Record<string, string>;
  noteDraft: string;
  onAssignModerator: (item: ModerationCaseView) => void;
  onAssignmentFocusChange: (assignmentId: string | null) => void;
  onBulkApproveModeration: () => void;
  onBulkAssignModerator: () => void;
  onBulkModeratorChange: (value: string) => void;
  onFeedbackDraftChange: (value: string) => void;
  onModeratorDraftChange: (caseId: string, value: string) => void;
  onNoteDraftChange: (value: string) => void;
  onOpenReleaseWorkflow: (assignmentId: string) => void;
  onQueueFilterChange: (filter: ModerationQueueFilter) => void;
  onQueueSearchChange: (value: string) => void;
  onQueueSortChange: (value: ModerationQueueSort) => void;
  onSaveAction: (action: "agree" | "adjust" | "return" | "escalate" | "approve") => void;
  onScoreDraftChange: (value: string) => void;
  onSelectCase: (caseId: string | null) => void;
  onToggleSelectAllVisible: (checked: boolean) => void;
  onToggleSelectedCase: (caseId: string, checked: boolean) => void;
  ownerAssignmentSummaries: {
    approvedReadyCount: number;
    assignmentId: string;
    assignmentTitle: string;
    escalatedCount: number;
  }[];
  queueFilter: ModerationQueueFilter;
  queueFilterOptions: Array<{
    count: number;
    label: string;
    value: ModerationQueueFilter;
  }>;
  queueSearch: string;
  queueSort: ModerationQueueSort;
  queueStats: {
    escalated: number;
    inProgress: number;
    moderated: number;
    pending: number;
  };
  saving: boolean;
  scoreDraft: string;
  selectedBulkApprovalSummaries: ModerationBulkApprovalSummary[];
  selectedCase: ModerationCaseView | null;
  selectedCaseIds: string[];
  userId?: string;
};

export const DemoModerationDashboardScreen = ({
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
}: ModerationDashboardScreenProps) => (
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
      selectableCaseIds={[
        ...bulkAssignableFilteredCases.map((item) => item.moderationCase.id),
        ...bulkApprovableFilteredCases.map((item) => item.moderationCase.id),
      ]}
      bulkAssignableCaseIds={bulkAssignableFilteredCases.map((item) => item.moderationCase.id)}
      bulkApprovableCaseIds={bulkApprovableFilteredCases.map((item) => item.moderationCase.id)}
      onBulkApproveModeration={onBulkApproveModeration}
      selectedBulkApprovalSummaries={selectedBulkApprovalSummaries}
      saving={saving}
      userId={userId}
    />

    <DemoModerationReviewDialog
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

export type { ModerationDashboardScreenProps };
