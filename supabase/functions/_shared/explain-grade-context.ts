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

type BreakdownRow = {
  criterion?: string | null;
  name?: string | null;
  score?: number | null;
  max_score?: number | null;
  maxScore?: number | null;
};

export type CriterionInsight = {
  criterion: string;
  name: string;
  score: number;
  maxScore: number;
  earnedPercentage: number;
  lostPoints: number;
  lostPercentage: number;
};

function toFiniteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function buildCriterionInsights(breakdown: unknown): CriterionInsight[] {
  if (!Array.isArray(breakdown)) return [];

  return breakdown
    .filter((row): row is BreakdownRow => Boolean(row) && typeof row === "object")
    .map((row) => {
      const criterion = typeof row.criterion === "string"
        ? row.criterion.trim()
        : typeof row.name === "string"
          ? row.name.trim()
          : "";
      const score = toFiniteNumber(row.score) ?? 0;
      const maxScore = toFiniteNumber(row.max_score ?? row.maxScore) ?? 0;
      const earnedPercentage = maxScore > 0 ? Number(((score / maxScore) * 100).toFixed(1)) : 0;
      const lostPoints = maxScore > 0 ? Number((maxScore - score).toFixed(2)) : 0;
      const lostPercentage = maxScore > 0 ? Number((((maxScore - score) / maxScore) * 100).toFixed(1)) : 0;

      return {
        criterion: criterion || "Unknown",
        name: criterion || "Unknown",
        score,
        maxScore,
        earnedPercentage,
        lostPoints,
        lostPercentage,
      };
    })
    .sort((left, right) => {
      if (right.lostPercentage !== left.lostPercentage) {
        return right.lostPercentage - left.lostPercentage;
      }
      return right.lostPoints - left.lostPoints;
    });
}

export function buildWeaknessGuidance(
  weakestCriterion: CriterionInsight | null,
  criterionInsights: CriterionInsight[],
) {
  if (!weakestCriterion) return "";

  const comparisonCriterion = criterionInsights.find((criterion) => criterion.name !== weakestCriterion.name) ?? null;
  const comparisonSentence = comparisonCriterion
    ? ` This is higher than the loss in ${comparisonCriterion.name}, where they lost ${comparisonCriterion.lostPercentage}%.`
    : "";

  return `${weakestCriterion.name} is the weakest criterion. The student scored ${weakestCriterion.score}/${weakestCriterion.maxScore}, meaning they lost ${weakestCriterion.lostPercentage}% of available marks.${comparisonSentence}`;
}

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
  const criterionInsights = buildCriterionInsights(grade.ai_breakdown);

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
    criterionInsights,
    weakestCriterion: criterionInsights[0] ?? null,
    gradingConfidence: grade.grading_confidence ?? null,
  };
}
