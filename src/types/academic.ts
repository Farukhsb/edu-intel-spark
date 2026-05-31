import type { AIGradeResponse, GradeBreakdownItem, IntegrityBatchFlag } from "@/lib/schemas/aiResponses";
import type { RubricCriterion } from "@/types";

export type AcademicGradeBreakdownItem = GradeBreakdownItem;
export type AcademicAIGradeResponse = AIGradeResponse;
export type AcademicIntegrityFlag = IntegrityBatchFlag;

export interface WorkflowRubricCriterion extends RubricCriterion {
  criterion: string;
  weight: number;
  description?: string | null;
  max_score?: number;
  score?: number;
  feedback?: string;
}

export interface ExternalExaminerExportRow {
  studentName: string;
  studentEmail: string;
  assignmentTitle: string;
  moduleCode: string;
  aiScore: number | null;
  lecturerScore: number | null;
  finalScore: number | null;
  gradeSource: string | null;
  aiFeedback: string;
  lecturerFeedback: string;
  finalFeedback: string;
  status: string;
  submittedAt: string;
  reviewedAt: string;
  reviewedBy: string;
  classification: string;
}

export interface ExternalExaminerAssignmentRow {
  id: string;
  title: string;
  module_code: string | null;
}

export interface ExternalExaminerSubmissionRow {
  id: string;
  assignment_id: string | null;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  status: string | null;
  submitted_at: string | null;
}

export interface ExternalExaminerGradeRow {
  submission_id: string;
  ai_score: number | null;
  lecturer_score: number | null;
  final_score: number | null;
  grade_source: string | null;
  ai_feedback: string | null;
  lecturer_feedback: string | null;
  final_feedback: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface ExternalExaminerProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

export const isWorkflowRubricCriterion = (value: unknown): value is WorkflowRubricCriterion => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return typeof candidate.criterion === "string" && typeof candidate.weight === "number";
};

export const toWorkflowRubric = (value: unknown): WorkflowRubricCriterion[] | null => {
  if (!Array.isArray(value)) return null;
  return value.filter(isWorkflowRubricCriterion);
};
