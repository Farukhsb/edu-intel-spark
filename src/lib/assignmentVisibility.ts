type StudentVisibleAssignment = {
  status: string;
  due_date: string | null;
};

type StudentSubmissionAvailabilityInput = {
  assignment: StudentVisibleAssignment;
  hasExistingSubmission: boolean;
  hasUser: boolean;
  now?: number;
};

export function hasAssignmentDueDatePassed(dueDate: string | null, now = Date.now()) {
  if (!dueDate) return false;

  const dueAt = new Date(dueDate).getTime();
  if (!Number.isFinite(dueAt)) return false;

  return dueAt <= now;
}

export function isAssignmentVisibleToStudent(
  assignment: StudentVisibleAssignment,
  now = Date.now(),
) {
  return assignment.status === "published" && !hasAssignmentDueDatePassed(assignment.due_date, now);
}

export function isAssignmentDueSoon(
  dueDate: string | null,
  now = Date.now(),
  windowMs = 7 * 24 * 60 * 60 * 1000,
) {
  if (!dueDate) return false;

  const dueAt = new Date(dueDate).getTime();
  if (!Number.isFinite(dueAt)) return false;

  const diff = dueAt - now;
  return diff > 0 && diff <= windowMs;
}

export function getStudentSubmissionAvailability({
  assignment,
  hasExistingSubmission,
  hasUser,
  now = Date.now(),
}: StudentSubmissionAvailabilityInput) {
  if (assignment.status !== "published") {
    return {
      canSubmit: false,
      ctaLabel: "Unavailable",
      helperText: "This assignment is not currently open for student submissions.",
    };
  }

  if (hasAssignmentDueDatePassed(assignment.due_date, now)) {
    return {
      canSubmit: false,
      ctaLabel: "Closed",
      helperText: "The due date has passed, so this assignment is no longer accepting submissions.",
    };
  }

  if (!hasUser) {
    return {
      canSubmit: false,
      ctaLabel: "Unavailable",
      helperText: "Sign in with a student account to submit work for this assignment.",
    };
  }

  if (hasExistingSubmission) {
    return {
      canSubmit: false,
      ctaLabel: "Already Submitted",
      helperText: "You have already submitted this assignment.",
    };
  }

  return {
    canSubmit: true,
    ctaLabel: "Submit My Work",
    helperText: "Upload your assignment file once. After submission, your work will enter the grading workflow.",
  };
}
