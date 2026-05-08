import type { ComponentProps } from "react";

import { WorkflowActionsSection } from "@/pages/dashboard/assignment-detail/ui";
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
  isDemo: boolean;
  lecturerActions: ReturnType<typeof useLecturerAssessmentActions>;
  submissionsCount: number;
  viewState: ReturnType<typeof useAssignmentDetailViewState>;
}

export const buildWorkflowActionsProps = ({
  automatedActions,
  currentUserId,
  fileActions,
  isDemo,
  lecturerActions,
  submissionsCount,
  viewState,
}: BuildWorkflowActionsPropsArgs): ComponentProps<typeof WorkflowActionsSection> => ({
  isDemo,
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
});
