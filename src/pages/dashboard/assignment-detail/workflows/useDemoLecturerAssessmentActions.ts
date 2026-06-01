import type { Dispatch, SetStateAction } from "react";

import type { useLecturerAssessmentActions } from "./useLecturerAssessmentActions";
import type {
  AssignmentDetailAssignment,
  AssignmentDetailSubmission,
  Grade,
  IntegrityReview,
  ModerationCase,
} from "@/pages/dashboard/assignment-detail/types";

type LecturerAssessmentActions = ReturnType<typeof useLecturerAssessmentActions>;

interface UseDemoLecturerAssessmentActionsArgs {
  assignment: AssignmentDetailAssignment | null;
  grades: Record<string, Grade>;
  integrityReviews: Record<string, IntegrityReview>;
  moderationCases: Record<string, ModerationCase>;
  reloadSubmissions: () => Promise<void>;
  selected: Set<string>;
  setModerationCases: Dispatch<SetStateAction<Record<string, ModerationCase>>>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  submissions: AssignmentDetailSubmission[];
  user: { id: string } | null;
}

export const useDemoLecturerAssessmentActions = (_args: UseDemoLecturerAssessmentActionsArgs): LecturerAssessmentActions => ({
  approveSubmission: async () => false,
  editFeedback: "",
  editScore: "",
  handleBulkApprove: async () => undefined,
  handleReleaseGrades: async () => undefined,
  handleSingleRelease: async () => undefined,
  openReview: () => undefined,
  sendToModeration: async () => false,
  queueFeedbackSummary: async () => undefined,
  queueGradeReleaseNotification: async () => undefined,
  reviewOpen: false,
  reviewGradeOverride: null,
  reviewSubmission: null,
  saveReview: async () => undefined,
  setEditFeedback: () => undefined,
  setEditScore: () => undefined,
  setReviewOpen: () => undefined,
  startManualReview: async () => false,
  startManualReviewForSubmissions: async () => undefined,
});
