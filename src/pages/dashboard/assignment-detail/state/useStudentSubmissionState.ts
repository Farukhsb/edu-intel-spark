import { useMemo } from "react";

import { getStudentSubmissionAvailability } from "@/lib/assignmentVisibility";
import type {
  AssignmentDetailAssignment,
  AssignmentDetailSubmission,
} from "@/pages/dashboard/assignment-detail/types";

interface UseStudentSubmissionStateArgs {
  assignment: AssignmentDetailAssignment | null;
  currentUserEmail: string | null;
  currentUserId: string | null;
  isLecturer: boolean;
  submissions: AssignmentDetailSubmission[];
}

interface UseStudentSubmissionStateResult {
  currentStudentSubmission: AssignmentDetailSubmission | null;
  hasExistingSubmission: boolean;
  studentSubmissionAvailability: ReturnType<typeof getStudentSubmissionAvailability>;
}

export const useStudentSubmissionState = ({
  assignment,
  currentUserEmail,
  currentUserId,
  isLecturer,
  submissions,
}: UseStudentSubmissionStateArgs): UseStudentSubmissionStateResult => {
  const hasExistingSubmission = useMemo(
    () =>
      !isLecturer &&
      submissions.some(
        (submission) =>
          submission.student_id === currentUserId ||
          (currentUserEmail && submission.student_email === currentUserEmail),
      ),
    [currentUserEmail, currentUserId, isLecturer, submissions],
  );

  const currentStudentSubmission = useMemo(() => {
    if (isLecturer) return null;

    return (
      [...submissions]
        .filter(
          (submission) =>
            submission.student_id === currentUserId ||
            (currentUserEmail && submission.student_email === currentUserEmail),
        )
        .sort(
          (left, right) =>
            new Date(right.submitted_at).getTime() - new Date(left.submitted_at).getTime(),
        )[0] ?? null
    );
  }, [currentUserEmail, currentUserId, isLecturer, submissions]);

  const studentSubmissionAvailability = useMemo(() => {
    if (!assignment) {
      return {
        canSubmit: false,
        ctaLabel: "Unavailable",
        helperText: "Assignment details are still loading.",
      };
    }

    return getStudentSubmissionAvailability({
      assignment,
      hasExistingSubmission,
      hasUser: Boolean(currentUserId),
    });
  }, [assignment, currentUserId, hasExistingSubmission]);

  return {
    currentStudentSubmission,
    hasExistingSubmission,
    studentSubmissionAvailability,
  };
};
