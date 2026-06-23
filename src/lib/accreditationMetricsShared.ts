export interface GradeLike {
  submission_id: string;
  ai_score: number | null;
  final_score: number | null;
  ai_feedback?: string | null;
  lecturer_score?: number | null;
  reviewed_by?: string | null;
  created_at?: string | null;
  reviewed_at?: string | null;
}

export interface SubmissionLike {
  id: string;
  assignment_id: string;
  submitted_at?: string | null;
  status?: string | null;
}

export interface AssignmentLike {
  id: string;
  title?: string | null;
  module_code?: string | null;
  due_date?: string | null;
  description?: string | null;
  rubric?: unknown;
}

export interface ProfileLike {
  id: string;
  role?: string | null;
}

export const tefRating = (score: number): "gold" | "silver" | "bronze" | "pending" =>
  score >= 80 ? "gold" : score >= 65 ? "silver" : score >= 50 ? "bronze" : "pending";

export const ensureNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
export const ensureString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);

export const resolveGradeScore = (grade: Pick<GradeLike, "final_score" | "lecturer_score" | "ai_score">) =>
  grade.final_score ?? grade.lecturer_score ?? grade.ai_score;

export const percentTrend = (score: number, benchmark: number) =>
  score >= benchmark ? `+${score - benchmark}%` : `${score - benchmark}%`;
