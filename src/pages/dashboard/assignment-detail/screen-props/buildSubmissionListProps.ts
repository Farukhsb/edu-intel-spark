import type { ComponentProps } from "react";
import type { NavigateFunction } from "react-router-dom";

import { buildAbsoluteAppUrl, copyTextToClipboard } from "@/lib/clipboard";
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
import type { useAutomatedAssessmentActions } from "@/pages/dashboard/assignment-detail/workflows";
import { toast } from "sonner";

interface BuildSubmissionListPropsArgs {
  assignment: AssignmentDetailAssignment;
  automatedActions: ReturnType<typeof useAutomatedAssessmentActions>;
  fileActions: ReturnType<typeof useSubmissionActions> & {
    openSubmissionFile: (submission: AssignmentDetailSubmission) => Promise<void>;
  };
  grades: Record<string, Grade>;
  isDemo: boolean;
  lecturerActions: ReturnType<typeof useLecturerAssessmentActions>;
  moderationCases: Record<string, ModerationCase>;
  navigate: NavigateFunction;
  reloadSubmissions: () => Promise<void>;
  searchPathname: string;
  submissions: AssignmentDetailSubmission[];
  viewState: ReturnType<typeof useAssignmentDetailViewState>;
}

export const buildSubmissionListProps = ({
  assignment,
  automatedActions,
  fileActions,
  grades,
  isDemo,
  lecturerActions,
  moderationCases,
  navigate,
  reloadSubmissions,
  searchPathname,
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
  gradingRecoveryIssues: automatedActions.lastSubmissionRecoveryIssues,
  openSubmissionFile: fileActions.openSubmissionFile,
  openModeration: () => navigate("/dashboard/moderation"),
  openReview: lecturerActions.openReview,
  startManualReview: lecturerActions.startManualReview,
  approveSubmission: lecturerActions.approveSubmission,
  releaseSubmission: lecturerActions.handleSingleRelease,
  loadSubmissions: reloadSubmissions,
  queueFeedbackSummary: lecturerActions.queueFeedbackSummary,
  queueGradeReleaseNotification: lecturerActions.queueGradeReleaseNotification,
  openReleasedResult: viewState.openReleasedResult,
  moderationReleaseHandoffState: viewState.moderationReleaseHandoffState,
  activeQueueFocus: viewState.queueFocus,
  focusQueue: (focus) => navigate(`${searchPathname}?source=queue&focus=${focus}`, { replace: true }),
  clearQueueFocus: () => navigate(searchPathname, { replace: true }),
  copyQueueLink: (focus) => {
    void (async () => {
      const copied = await copyTextToClipboard(
        buildAbsoluteAppUrl(`${searchPathname}?source=queue&focus=${focus}`),
      );
      if (copied) {
        toast.success("Queue link copied.");
        return;
      }

      toast.error("Could not copy the queue link.");
    })();
  },
});
