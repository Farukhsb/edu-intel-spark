import type { ComponentProps } from "react";

import { WorkflowActionsSection } from "@/pages/dashboard/assignment-detail/ui";
import { WorkflowActionsSection as DemoWorkflowActionsSection } from "@/pages/dashboard/assignment-detail/ui/demo-workflow-actions-section";
import type { useAssignmentDetailViewState } from "@/pages/dashboard/assignment-detail/state";
import type {
  useAutomatedAssessmentActions,
  useLecturerAssessmentActions,
  useSubmissionActions,
} from "@/pages/dashboard/assignment-detail/workflows";
import { SUBMISSION_FILE_ACCEPT } from "@/pages/dashboard/assignment-detail/workflows";
import type { AssignmentDetailSubmission } from "@/pages/dashboard/assignment-detail/types";

interface BuildWorkflowActionsPropsArgs {
  automatedActions: ReturnType<typeof useAutomatedAssessmentActions>;
  currentUserId: string | null;
  fileActions: ReturnType<typeof useSubmissionActions> & {
    openSubmissionFile: (submission: AssignmentDetailSubmission) => Promise<void>;
  };
  lecturerActions: ReturnType<typeof useLecturerAssessmentActions>;
  submissions: AssignmentDetailSubmission[];
  submissionsCount: number;
  viewState: ReturnType<typeof useAssignmentDetailViewState>;
}

export const buildWorkflowActionsProps = ({
  automatedActions,
  currentUserId,
  fileActions,
  lecturerActions,
  submissions,
  submissionsCount,
  viewState,
}: BuildWorkflowActionsPropsArgs): ComponentProps<typeof WorkflowActionsSection> => ({
  isLecturer: viewState.isLecturer,
  submissionFileAccept: SUBMISSION_FILE_ACCEPT,
  fileInputRef: fileActions.fileInputRef,
  bulkInputRef: fileActions.bulkInputRef,
  handleStudentSubmit: fileActions.handleStudentSubmit,
  studentSubmissionAvailability: viewState.studentSubmissionAvailability,
  uploading: fileActions.uploading,
  uploadProgress: fileActions.uploadProgress,
  currentUserId,
  currentStudentSubmission: viewState.currentStudentSubmission,
  openReleasedResult: viewState.openReleasedResult,
  handleBulkUpload: fileActions.handleBulkUpload,
  handlePlagiarismCheck: automatedActions.handlePlagiarismCheck,
  checkingPlagiarism: automatedActions.checkingPlagiarism,
  integrityRuntimeWarning: viewState.integrityRuntimeWarning,
  submissionsCount,
  handleAIGrade: automatedActions.handleAIGrade,
  handleRetryFailedOnly: automatedActions.retryFailedOnly,
  workflowLaneSummary: viewState.workflowLaneSummary,
  workflowReadiness: viewState.workflowReadiness,
  selectedWorkflowGuidance: viewState.selectedWorkflowGuidance,
  selectedWorkflowState: viewState.selectedWorkflowState,
  grading: automatedActions.grading,
  selectedSize: viewState.selected.size,
  handleReleaseGrades: lecturerActions.handleReleaseGrades,
  handleBulkApprove: lecturerActions.handleBulkApprove,
  searchQuery: viewState.searchQuery,
  setSearchQuery: viewState.setSearchQuery,
  statusFilter: viewState.statusFilter,
  setStatusFilter: viewState.setStatusFilter,
  exportReviewedReports: viewState.exportReviewedReports,
  gradingElapsed: automatedActions.gradingElapsed,
  gradingCount: automatedActions.gradingCount,
  lastGradingRunSummary: automatedActions.lastGradingRunSummary,
  handleStartManualReviewForFailed: () =>
    lecturerActions.startManualReviewForSubmissions(
      submissions.filter((submission) => {
        const issue = automatedActions.lastSubmissionRecoveryIssues[submission.id];
        return issue != null && issue.type !== "missing_file";
      }),
    ),
});

type BuildDemoWorkflowActionsPropsArgs = BuildWorkflowActionsPropsArgs;

export const buildDemoWorkflowActionsProps = (
  args: BuildDemoWorkflowActionsPropsArgs,
): ComponentProps<typeof DemoWorkflowActionsSection> =>
  ({
    ...buildWorkflowActionsProps(args),
  }) as ComponentProps<typeof DemoWorkflowActionsSection>;
