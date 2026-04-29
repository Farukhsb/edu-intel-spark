type SubmissionAccessRow = {
  id: string;
  assignment_id: string | null;
  student_id: string | null;
  student_name?: string | null;
  student_email?: string | null;
  file_name?: string | null;
  status?: string | null;
};

type GradeAccessRow = {
  id: string;
  submission_id: string;
  ai_score?: number | null;
  final_score?: number | null;
  ai_feedback?: string | null;
  ai_breakdown?: unknown;
  grading_confidence?: number | null;
};

type AssignmentAccessRow = {
  id: string;
  title?: string | null;
  module_code?: string | null;
  max_score?: number | null;
};

export type ReleasedGradeContextRows = {
  submission: SubmissionAccessRow | null;
  grade: GradeAccessRow | null;
  assignment?: AssignmentAccessRow | null;
};

type CreateAccessError = (status: number, message: string) => Error;

const defaultCreateAccessError: CreateAccessError = (status, message) => {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
};

export function buildReleasedGradeContext(
  rows: ReleasedGradeContextRows,
  userId: string,
  createAccessError: CreateAccessError = defaultCreateAccessError,
) {
  const { submission, grade, assignment } = rows;

  if (!submission) {
    throw createAccessError(404, "Submission not found");
  }

  if (submission.student_id !== userId) {
    throw createAccessError(403, "Forbidden");
  }

  if (submission.status !== "released") {
    throw createAccessError(403, "Grade is not released");
  }

  if (!grade) {
    throw createAccessError(404, "Released grade not found");
  }

  const totalGrade = Number(grade.final_score ?? grade.ai_score);
  if (!Number.isFinite(totalGrade)) {
    throw createAccessError(404, "Released grade not found");
  }

  return {
    submissionId: submission.id,
    gradeId: grade.id,
    assessment: assignment
      ? `${assignment.module_code || ""} ${assignment.title || ""}`.trim() || submission.file_name || submission.id
      : submission.file_name || submission.id,
    status: submission.status,
    totalGrade,
    maxScore: assignment?.max_score ?? null,
    feedback: grade.ai_feedback ?? "",
    breakdown: Array.isArray(grade.ai_breakdown) ? grade.ai_breakdown : [],
    gradingConfidence: grade.grading_confidence ?? null,
  };
}
