import type { Tables } from "@/integrations/supabase/types";
import type { AssessmentWorkflowStatus } from "@/lib/assessmentWorkflow";
import type { Assignment, GradeBreakdown, Submission } from "@/types";
import type {
  AcademicIntegrityFlag,
  AcademicGradeBreakdownItem,
  WorkflowRubricCriterion,
} from "@/types/academic";

export type SubmissionStatus = AssessmentWorkflowStatus;

export type AssignmentDetailSubmission = Submission & {
  id: string;
  assignment_id: string;
  student_name: string | null;
  student_email: string | null;
  file_name: string;
  file_type: string | null;
  file_url: string;
  status: SubmissionStatus;
  submitted_at: string;
  student_id: string | null;
};

export interface AssignmentDetailBreakdown
  extends Omit<AcademicGradeBreakdownItem, "feedback">,
    Omit<GradeBreakdown, "feedback"> {
  feedback?: string;
  evidence_snippet?: string | null;
  review_required?: boolean | null;
  error_type?: "arithmetic_slip" | "conceptual_flaw" | "none";
}

export interface GradingMetadata {
  fairness_notes?: string[];
  math_analysis?: {
    solver_signals?: string[];
  } | null;
  [key: string]: unknown;
}

export interface Grade {
  id: string;
  submission_id: string;
  ai_score: number | null;
  ai_feedback: string | null;
  ai_breakdown: AssignmentDetailBreakdown[] | null;
  assignment_type?: string | null;
  grading_confidence?: number | null;
  grading_metadata?: GradingMetadata | null;
  lecturer_score: number | null;
  lecturer_feedback: string | null;
  final_score: number | null;
  final_feedback: string | null;
}

export type PlagiarismFlag = AcademicIntegrityFlag;
export type IntegrityReview = Tables<"academic_integrity_reviews">;
export type ModerationCase = Tables<"moderation_cases">;

export type AssignmentDetailAssignment = Assignment & {
  id: string;
  title: string;
  description: string | null;
  module_code: string | null;
  max_score: number;
  due_date: string | null;
  status: string;
  lecturer_id: string;
  rubric: WorkflowRubricCriterion[] | null;
};
