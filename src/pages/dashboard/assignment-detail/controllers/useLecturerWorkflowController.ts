import type { Dispatch, SetStateAction } from "react";

import {
  useAutomatedAssessmentActions,
  useLecturerAssessmentActions,
} from "@/pages/dashboard/assignment-detail/workflows";
import type {
  AssignmentDetailAssignment,
  AssignmentDetailSubmission,
  Grade,
  IntegrityReview,
  ModerationCase,
  PlagiarismFlag,
} from "@/pages/dashboard/assignment-detail/types";

interface LecturerWorkflowUser {
  id: string;
}

interface UseLecturerWorkflowControllerArgs {
  assignment: AssignmentDetailAssignment | null;
  grades: Record<string, Grade>;
  integrityReviews: Record<string, IntegrityReview>;
  isDemo: boolean;
  moderationCases: Record<string, ModerationCase>;
  reloadSubmissions: () => Promise<void>;
  role: string | null;
  selected: Set<string>;
  setModerationCases: Dispatch<SetStateAction<Record<string, ModerationCase>>>;
  setPlagiarismFlags: Dispatch<SetStateAction<PlagiarismFlag[]>>;
  setPlagiarismSummary: Dispatch<
    SetStateAction<string>
  >;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  submissions: AssignmentDetailSubmission[];
  user: LecturerWorkflowUser | null;
}

export const useLecturerWorkflowController = ({
  assignment,
  grades,
  integrityReviews,
  isDemo,
  moderationCases,
  reloadSubmissions,
  role,
  selected,
  setModerationCases,
  setPlagiarismFlags,
  setPlagiarismSummary,
  setSelected,
  submissions,
  user,
}: UseLecturerWorkflowControllerArgs) => {
  const automatedActions = useAutomatedAssessmentActions({
    assignment,
    grades,
    isDemo,
    reloadSubmissions,
    role,
    selected,
    setPlagiarismFlags,
    setPlagiarismSummary,
    setSelected,
    submissions,
    user,
  });

  const lecturerActions = useLecturerAssessmentActions({
    assignment,
    grades,
    integrityReviews,
    isDemo,
    moderationCases,
    reloadSubmissions,
    selected,
    setModerationCases,
    setSelected,
    submissions,
    user,
  });

  return {
    automatedActions,
    lecturerActions,
  };
};
