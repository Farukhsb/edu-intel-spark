import type { ModerationCaseView, ModerationQueueFilter, ModerationQueueSort } from "@/lib/moderationWorkflow";

import type { ModerationBulkApprovalSummary, ModerationProfile } from "../types";

export type ModerationDashboardScreenProps = {
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
