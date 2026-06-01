import type { NavigateFunction } from "react-router-dom";

import {
  buildFocusStateProps,
  buildHeroCardProps,
  buildReadinessCardProps,
  buildReviewDialogProps,
  buildDemoSubmissionListProps,
  buildSubmissionListProps,
  buildWorkflowActionsProps,
} from "@/pages/dashboard/assignment-detail/screen-props";
import type { AssignmentDetailScreenProps } from "@/pages/dashboard/assignment-detail/ui/screen";
import type { DemoAssignmentDetailScreenProps } from "@/pages/dashboard/assignment-detail/ui/demo-screen";
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
  backHref: string;
  currentUserId: string | null;
  fileActions: ReturnType<typeof useSubmissionActions> & {
    openSubmissionFile: (submission: AssignmentDetailSubmission) => Promise<void>;
  };
  grades: Record<string, Grade>;
  integrityCard: {
    shouldShowCard: boolean;
  } & NonNullable<AssignmentDetailScreenProps["integrityCardProps"]>["integrityCard"];
  lecturerActions: ReturnType<typeof useLecturerAssessmentActions>;
  moderationCases: Record<string, ModerationCase>;
  navigate: NavigateFunction;
  isDemo: boolean;
  plagiarismFlags: NonNullable<AssignmentDetailScreenProps["integrityCardProps"]>["plagiarismFlags"];
  plagiarismSummary: NonNullable<AssignmentDetailScreenProps["integrityCardProps"]>["plagiarismSummary"];
  reloadSubmissions: () => Promise<void>;
  searchPathname: string;
  submissions: AssignmentDetailSubmission[];
  viewState: ReturnType<typeof useAssignmentDetailViewState>;
  automatedActions: ReturnType<typeof useAutomatedAssessmentActions>;
}

export const buildLiveAssignmentDetailScreenProps = ({
  assignment,
  automatedActions,
  backHref,
  currentUserId,
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
  heroCardProps: buildHeroCardProps({
    assignment,
    backHref,
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
    automatedActions,
    fileActions,
    grades,
    lecturerActions,
    moderationCases,
    navigate,
    reloadSubmissions,
    searchPathname,
    submissions,
    viewState,
  }),
  workflowActionsProps: buildWorkflowActionsProps({
    automatedActions,
    currentUserId,
    fileActions,
    isDemo,
    lecturerActions,
      submissions,
      submissionsCount: submissions.length,
      viewState,
    }),
});

type BuildDemoAssignmentDetailScreenPropsArgs = BuildAssignmentDetailScreenPropsArgs & {
  demoAssignmentSet: DemoAssignmentDetailScreenProps["demoAssignmentSet"];
};

export const buildDemoAssignmentDetailScreenProps = ({
  demoAssignmentSet,
  ...args
}: BuildDemoAssignmentDetailScreenPropsArgs): DemoAssignmentDetailScreenProps => ({
  demoAssignmentSet,
  ...buildLiveAssignmentDetailScreenProps(args),
  submissionListProps: buildDemoSubmissionListProps(args),
});
