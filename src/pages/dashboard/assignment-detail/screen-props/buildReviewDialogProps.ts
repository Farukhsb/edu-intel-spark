import type { SubmissionReviewDialogProps } from "@/pages/dashboard/assignment-detail/ui/review-dialog";
import type { DemoSubmissionReviewDialogProps } from "@/pages/dashboard/assignment-detail/ui/demo-review-dialog";
import type { useLecturerAssessmentActions } from "@/pages/dashboard/assignment-detail/workflows";
import type { Grade } from "@/pages/dashboard/assignment-detail/types";

interface BuildReviewDialogPropsArgs {
  assignmentMaxScore: number;
  grades: Record<string, Grade>;
  lecturerActions: ReturnType<typeof useLecturerAssessmentActions>;
}

export const buildReviewDialogProps = ({
  assignmentMaxScore,
  grades,
  lecturerActions,
}: BuildReviewDialogPropsArgs): SubmissionReviewDialogProps => ({
  assignmentMaxScore,
  editFeedback: lecturerActions.editFeedback,
  editScore: lecturerActions.editScore,
  grade:
    lecturerActions.reviewGradeOverride ??
    (lecturerActions.reviewSubmission ? grades[lecturerActions.reviewSubmission.id] ?? null : null),
  onEditFeedbackChange: lecturerActions.setEditFeedback,
  onEditScoreChange: lecturerActions.setEditScore,
  onOpenChange: lecturerActions.setReviewOpen,
  onSave: lecturerActions.saveReview,
  open: lecturerActions.reviewOpen,
  reviewSubmission: lecturerActions.reviewSubmission,
});

export const buildDemoReviewDialogProps = ({
  assignmentMaxScore,
  grades,
  lecturerActions,
}: BuildReviewDialogPropsArgs): DemoSubmissionReviewDialogProps =>
  ({
    ...buildReviewDialogProps({
      assignmentMaxScore,
      grades,
      lecturerActions,
    }),
  }) as DemoSubmissionReviewDialogProps;
