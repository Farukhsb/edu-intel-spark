import type { ComponentProps } from "react";

import { SubmissionReviewDialog } from "@/pages/dashboard/assignment-detail/ui";
import type { useLecturerAssessmentActions } from "@/pages/dashboard/assignment-detail/workflows";
import type { Grade } from "@/pages/dashboard/assignment-detail/types";

interface BuildReviewDialogPropsArgs {
  assignmentMaxScore: number;
  grades: Record<string, Grade>;
  isDemo: boolean;
  lecturerActions: ReturnType<typeof useLecturerAssessmentActions>;
}

export const buildReviewDialogProps = ({
  assignmentMaxScore,
  grades,
  isDemo,
  lecturerActions,
}: BuildReviewDialogPropsArgs): ComponentProps<typeof SubmissionReviewDialog> => ({
  assignmentMaxScore,
  editFeedback: lecturerActions.editFeedback,
  editScore: lecturerActions.editScore,
  grade: lecturerActions.reviewSubmission ? grades[lecturerActions.reviewSubmission.id] ?? null : null,
  isDemo,
  onEditFeedbackChange: lecturerActions.setEditFeedback,
  onEditScoreChange: lecturerActions.setEditScore,
  onOpenChange: lecturerActions.setReviewOpen,
  onSave: lecturerActions.saveReview,
  open: lecturerActions.reviewOpen,
  reviewSubmission: lecturerActions.reviewSubmission,
});
