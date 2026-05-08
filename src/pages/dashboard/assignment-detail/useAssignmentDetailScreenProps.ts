import type { NavigateFunction } from "react-router-dom";

import {
  buildFocusStateProps,
  buildHeroCardProps,
  buildReadinessCardProps,
  buildReviewDialogProps,
  buildSubmissionListProps,
  buildWorkflowActionsProps,
} from "@/pages/dashboard/assignment-detail/screen-props";
import type { AssignmentDetailScreenProps } from "@/pages/dashboard/assignment-detail/ui";
import type { useAssignmentDetailViewState } from "@/pages/dashboard/assignment-detail/state";
import type {
  useAutomatedAssessmentActions,
  useLecturerAssessmentActions,
  useSubmissionActions,
} from "@/pages/dashboard/assignment-detail/workflows";
import type {
  AssignmentDetailAssignment,
  AssignmentDetailSubmission,
  Grade,
  ModerationCase,
} from "@/pages/dashboard/assignment-detail/types";

interface BuildAssignmentDetailScreenPropsArgs {
  assignment: AssignmentDetailAssignment;
  currentUserId: string | null;
  demoAssignmentSet: AssignmentDetailScreenProps["demoAssignmentSet"];
  fileActions: ReturnType<typeof useSubmissionActions> & {
    openSubmissionFile: (submission: AssignmentDetailSubmission) => Promise<void>;
  };
  grades: Record<string, Grade>;
  integrityCard: {
    shouldShowCard: boolean;
  } & NonNullable<AssignmentDetailScreenProps["integrityCardProps"]>["integrityCard"];
  isDemo: boolean;
  lecturerActions: ReturnType<typeof useLecturerAssessmentActions>;
  moderationCases: Record<string, ModerationCase>;
  navigate: NavigateFunction;
  plagiarismFlags: NonNullable<AssignmentDetailScreenProps["integrityCardProps"]>["plagiarismFlags"];
  plagiarismSummary: NonNullable<AssignmentDetailScreenProps["integrityCardProps"]>["plagiarismSummary"];
  reloadSubmissions: () => Promise<void>;
  searchPathname: string;
  submissions: AssignmentDetailSubmission[];
  viewState: ReturnType<typeof useAssignmentDetailViewState>;
  automatedActions: ReturnType<typeof useAutomatedAssessmentActions>;
}

export const buildAssignmentDetailScreenProps = ({
  assignment,
  automatedActions,
  currentUserId,
  demoAssignmentSet,
  fileActions,
  grades,
  integrityCard,
  isDemo,
  lecturerActions,
  moderationCases,
  navigate,
  plagiarismFlags,
  plagiarismSummary,
  reloadSubmissions,
  searchPathname,
  submissions,
  viewState,
}: BuildAssignmentDetailScreenPropsArgs): AssignmentDetailScreenProps => ({
  demoAssignmentSet,
  heroCardProps: buildHeroCardProps({
    assignment,
    navigate,
    viewState,
  }),
  integrityCardProps: integrityCard.shouldShowCard
    ? {
        integrityCard,
        onClear: viewState.onClearIntegrityCard,
        plagiarismFlags,
        plagiarismSummary,
      }
    : null,
  isDemo,
  ...buildFocusStateProps({
    navigate,
    searchPathname,
    viewState,
  }),
  readinessCardProps: buildReadinessCardProps({
    viewState,
  }),
  reviewDialogProps: buildReviewDialogProps({
    assignmentMaxScore: assignment.max_score,
    grades,
    isDemo,
    lecturerActions,
  }),
  rubric: assignment.rubric ?? [],
  submissionListProps: buildSubmissionListProps({
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
  }),
  workflowActionsProps: buildWorkflowActionsProps({
    automatedActions,
    currentUserId,
    fileActions,
    isDemo,
    lecturerActions,
    submissionsCount: submissions.length,
    viewState,
  }),
});
