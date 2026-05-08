import type { ComponentProps } from "react";
import type { NavigateFunction } from "react-router-dom";

import { SubmissionListSection } from "@/pages/dashboard/assignment-detail/ui";
import type { useAssignmentDetailViewState } from "@/pages/dashboard/assignment-detail/state";
import type {
  useLecturerAssessmentActions,
  useSubmissionActions,
} from "@/pages/dashboard/assignment-detail/workflows";
import type {
  AssignmentDetailAssignment,
  AssignmentDetailSubmission,
  Grade,
  ModerationCase,
} from "@/pages/dashboard/assignment-detail/types";

interface BuildSubmissionListPropsArgs {
  assignment: AssignmentDetailAssignment;
  fileActions: ReturnType<typeof useSubmissionActions> & {
    openSubmissionFile: (submission: AssignmentDetailSubmission) => Promise<void>;
  };
  grades: Record<string, Grade>;
  isDemo: boolean;
  lecturerActions: ReturnType<typeof useLecturerAssessmentActions>;
  moderationCases: Record<string, ModerationCase>;
  navigate: NavigateFunction;
  reloadSubmissions: () => Promise<void>;
  submissions: AssignmentDetailSubmission[];
  viewState: ReturnType<typeof useAssignmentDetailViewState>;
}

export const buildSubmissionListProps = ({
  assignment,
  fileActions,
  grades,
  isDemo,
  lecturerActions,
  moderationCases,
  navigate,
  reloadSubmissions,
  submissions,
  viewState,
}: BuildSubmissionListPropsArgs): ComponentProps<typeof SubmissionListSection> => ({
  submissions,
  filteredSubmissions: viewState.filteredSubmissions,
  isLecturer: viewState.isLecturer,
  selected: viewState.selected,
  toggleAll: viewState.toggleAll,
  toggleSelect: viewState.toggleSelect,
  grades,
  moderationCases,
  assignment,
  isDemo,
  openSubmissionFile: fileActions.openSubmissionFile,
  openModeration: () => navigate("/dashboard/moderation"),
  openReview: lecturerActions.openReview,
  approveSubmission: lecturerActions.approveSubmission,
  releaseSubmission: lecturerActions.handleSingleRelease,
  loadSubmissions: reloadSubmissions,
  queueFeedbackSummary: lecturerActions.queueFeedbackSummary,
  queueGradeReleaseNotification: lecturerActions.queueGradeReleaseNotification,
  openReleasedResult: viewState.openReleasedResult,
});
