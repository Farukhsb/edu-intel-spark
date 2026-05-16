import { useSubmissionActions, useSubmissionFileActions } from "@/pages/dashboard/assignment-detail/workflows";
import type {
  AssignmentDetailAssignment,
  AssignmentDetailSubmission,
} from "@/pages/dashboard/assignment-detail/types";

interface StudentWorkflowUser {
  email?: string | null;
  id: string;
}

interface StudentWorkflowProfile {
  email?: string | null;
  full_name?: string | null;
  id?: string | null;
}

interface UseStudentWorkflowControllerArgs {
  assignment: AssignmentDetailAssignment | null;
  assignmentId: string | null;
  isDemo: boolean;
  profile: StudentWorkflowProfile | null;
  reloadSubmissions: () => Promise<void>;
  submissions: AssignmentDetailSubmission[];
  user: StudentWorkflowUser | null;
}

export const useStudentWorkflowController = ({
  assignment,
  assignmentId,
  isDemo,
  profile,
  reloadSubmissions,
  submissions,
  user,
}: UseStudentWorkflowControllerArgs) => {
  const submissionActions = useSubmissionActions({
    assignment,
    assignmentId,
    isDemo,
    user,
    profile,
    submissions,
    reloadSubmissions,
  });

  const { openSubmissionFile } = useSubmissionFileActions();

  return {
    ...submissionActions,
    openSubmissionFile,
  };
};
