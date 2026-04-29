type StudentVisibleAssignment = {
  status: string;
  due_date: string | null;
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
