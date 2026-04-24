export interface RubricCriterion {
  criterion: string;
  weight: number;
  description?: string | null;
  max_score?: number;
  score?: number;
  feedback?: string;
}

export interface GradeBreakdown {
  criterion: string;
  score: number;
  max_score: number;
  feedback?: string | null;
  evidence?: string | string[] | null;
  confidence_score?: number | null;
  performance_band?: string | null;
  rubric_expectation?: string | null;
  reason_for_score?: string | null;
  improvement_actions?: string[] | null;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id?: string | null;
  student_name?: string | null;
  student_email?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_url?: string | null;
  extracted_text?: string | null;
  status?: string;
  submitted_at?: string | null;
  created_at?: string | null;
}

export interface Assignment {
  id: string;
  title: string;
  description?: string | null;
  module_code?: string | null;
  lecturer_id?: string | null;
  due_date?: string | null;
  status?: string | null;
  max_score: number;
  rubric?: RubricCriterion[] | null;
}

export interface AIResponseCriterion {
  criterion_name: string;
  awarded_score: number;
  max_score: number;
  reason_for_score: string;
  evidence_from_submission: string[];
  confidence_score: number;
  performance_band?: string | null;
  rubric_expectation?: string | null;
  improvement_actions?: string[] | null;
  error_type?: "arithmetic_slip" | "conceptual_flaw" | "none";
}

export interface AIResponse {
  total_score: number;
  overall_feedback: string;
  confidence_score: number;
  lecturer_review_required?: boolean;
  criteria: AIResponseCriterion[];
  math_analysis?: {
    detected: boolean;
    summary?: string | null;
  } | null;
}
