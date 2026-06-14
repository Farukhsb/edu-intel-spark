import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { ModerationQueueSectionProps } from "./queue-section.parts";
import {
  ModerationQueueBulkApprovePanel,
  ModerationQueueBulkAssignPanel,
  ModerationQueueCaseList,
  ModerationQueueFocusBanner,
  ModerationQueueHeader,
} from "./queue-section.parts";

export const ModerationQueueSection = (props: ModerationQueueSectionProps) => (
  <Card>
    <CardHeader>
      <ModerationQueueHeader
        queueFilter={props.queueFilter}
        queueFilterOptions={props.queueFilterOptions}
        queueSearch={props.queueSearch}
        queueSort={props.queueSort}
        onQueueFilterChange={props.onQueueFilterChange}
        onQueueSearchChange={props.onQueueSearchChange}
        onQueueSortChange={props.onQueueSortChange}
      />
      <CardDescription>
        Moderation reuses the existing confidence, integrity, maths, and lecturer override signals. It does not auto-release final grades.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <ModerationQueueFocusBanner
        assignmentFocusTitle={props.assignmentFocusTitle}
        onClearAssignmentFocus={props.onClearAssignmentFocus}
      />
      <ModerationQueueBulkAssignPanel
        bulkAssignableCaseIds={props.bulkAssignableCaseIds}
        bulkModeratorId={props.bulkModeratorId}
        lecturers={props.lecturers}
        onBulkAssignModerator={props.onBulkAssignModerator}
        onBulkModeratorChange={props.onBulkModeratorChange}
        onToggleSelectAllVisible={props.onToggleSelectAllVisible}
        saving={props.saving}
        selectedCaseIds={props.selectedCaseIds}
        selectableCaseIds={props.selectableCaseIds}
      />
      <ModerationQueueBulkApprovePanel
        bulkApprovableCaseIds={props.bulkApprovableCaseIds}
        onBulkApproveModeration={props.onBulkApproveModeration}
        selectedBulkApprovalSummaries={props.selectedBulkApprovalSummaries}
        saving={props.saving}
      />
      <ModerationQueueCaseList
        cases={props.cases}
        onOpenReleaseWorkflow={props.onOpenReleaseWorkflow}
        onSelectCase={props.onSelectCase}
        onToggleSelectedCase={props.onToggleSelectedCase}
        selectedCaseIds={props.selectedCaseIds}
        selectableCaseIds={props.selectableCaseIds}
        bulkApprovableCaseIds={props.bulkApprovableCaseIds}
        userId={props.userId}
      />
    </CardContent>
  </Card>
);
