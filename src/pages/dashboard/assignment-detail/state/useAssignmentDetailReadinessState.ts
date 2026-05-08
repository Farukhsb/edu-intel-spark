import { useMemo } from "react";

import { canReleaseStatus } from "@/lib/assessmentWorkflow";
import {
  getLecturerAssignmentWorkflowReadiness,
  getStudentAssignmentWorkflowReadiness,
  type WorkflowReadinessState,
} from "@/pages/dashboard/assignment-detail/domain";
import type { AssignmentDetailSubmission } from "@/pages/dashboard/assignment-detail/types";

const MAX_INTEGRITY_REQUEST_SUBMISSIONS = 80;
const INTEGRITY_RUNTIME_WARNING_THRESHOLD = 30;

interface UseAssignmentDetailReadinessStateArgs {
  currentStudentSubmissionStatus: AssignmentDetailSubmission["status"] | null;
  isLecturer: boolean;
  submissions: AssignmentDetailSubmission[];
}

interface UseAssignmentDetailReadinessStateResult {
  integrityRuntimeWarning: string | null;
  workflowReadiness: WorkflowReadinessState;
}

export const useAssignmentDetailReadinessState = ({
  currentStudentSubmissionStatus,
  isLecturer,
  submissions,
}: UseAssignmentDetailReadinessStateArgs): UseAssignmentDetailReadinessStateResult => {
  const integrityRuntimeWarning =
    submissions.length > MAX_INTEGRITY_REQUEST_SUBMISSIONS
      ? `Large cohort: ${submissions.length} submissions. The backend will switch to limited large-cohort mode and may skip full peerwise comparison.`
      : submissions.length > INTEGRITY_RUNTIME_WARNING_THRESHOLD
        ? `Large cohort: ${submissions.length} submissions. Integrity scanning may take longer than usual.`
        : null;

  const workflowReadiness = useMemo(
    () =>
      isLecturer
        ? getLecturerAssignmentWorkflowReadiness({
            statuses: submissions.map((submission) => submission.status),
            hasReleaseReady: submissions.some((submission) => canReleaseStatus(submission.status)),
            hasApprovable: submissions.some(
              (submission) =>
                submission.status === "ai_graded" ||
                submission.status === "moderated" ||
                submission.status === "under_review",
            ),
            integrityRuntimeWarning,
          })
        : getStudentAssignmentWorkflowReadiness({
            currentStatus: currentStudentSubmissionStatus,
          }),
    [currentStudentSubmissionStatus, integrityRuntimeWarning, isLecturer, submissions],
  );

  return {
    integrityRuntimeWarning,
    workflowReadiness,
  };
};
