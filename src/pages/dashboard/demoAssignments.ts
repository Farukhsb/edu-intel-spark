import type { RubricCriterion } from "@/components/RubricBuilder";
import {
  SYNTHETIC_ASSIGNMENT_SETS,
  SYNTHETIC_ASSIGNMENT_SET_CREATED_AT,
  getSyntheticAssignmentSetById,
} from "@/data/assignmentSets";
import type { AcademicIntegrityFlag } from "@/types/academic";

export interface DemoAssignmentRecord {
  id: string;
  title: string;
  description: string | null;
  module_code: string | null;
  lecturer_id: string;
  max_score: number;
  due_date: string | null;
  status: "draft" | "published" | "closed";
  created_at: string;
  rubric: RubricCriterion[];
  cohorts: string[];
  departments: string[];
  target_cohorts: string[];
  target_departments: string[];
}

export interface DemoAssignmentSubmissionRecord {
  id: string;
  assignment_id: string;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  file_name: string;
  file_type: string | null;
  file_url: string;
  status:
    | "submitted"
    | "ai_grading"
    | "ai_graded"
    | "first_review"
    | "moderation_pending"
    | "moderation_in_progress"
    | "moderated"
    | "escalated"
    | "under_review"
    | "approved"
    | "released";
  submitted_at: string;
}

export interface DemoAssignmentGradeRecord {
  id: string;
  submission_id: string;
  ai_score: number | null;
  ai_feedback: string | null;
  ai_breakdown: Array<{
    criterion: string;
    score: number;
    max_score: number;
    feedback: string;
    confidence_score: number;
    evidence_snippet?: string | null;
    rubric_expectation?: string | null;
    improvement_actions?: string[] | null;
    review_required?: boolean | null;
    error_type?: "arithmetic_slip" | "conceptual_flaw" | "none";
  }>;
  assignment_type: string | null;
  grading_confidence: number | null;
  grading_metadata: {
    fairness_notes?: string[];
    math_analysis?: {
      solver_signals?: string[];
    } | null;
  } | null;
  lecturer_score: number | null;
  lecturer_feedback: string | null;
  final_score: number | null;
  final_feedback: string | null;
}

export const DEMO_ASSIGNMENTS: DemoAssignmentRecord[] = SYNTHETIC_ASSIGNMENT_SETS.map((set) => ({
  id: set.id,
  title: set.template.title,
  description: set.template.description,
  module_code: set.template.moduleCode,
  lecturer_id: "demo-lecturer",
  max_score: set.template.maxScore,
  due_date: set.template.dueDate,
  status: set.template.status,
  created_at: SYNTHETIC_ASSIGNMENT_SET_CREATED_AT,
  rubric: set.template.rubric,
  cohorts: [],
  departments: [],
  target_cohorts: set.template.targetCohorts,
  target_departments: set.template.targetDepartments,
}));

export const DEMO_ASSIGNMENT_SUBMISSIONS: Record<string, DemoAssignmentSubmissionRecord[]> = Object.fromEntries(
  SYNTHETIC_ASSIGNMENT_SETS.map((set) => [
    set.id,
    set.submissions.map((submission) => ({
      id: submission.id,
      assignment_id: set.id,
      student_id: submission.studentId,
      student_name: submission.studentName,
      student_email: submission.studentEmail,
      file_name: submission.fileName,
      file_type: submission.fileType,
      file_url: submission.fileUrl,
      status: submission.status,
      submitted_at: submission.submittedAt,
    })),
  ]),
);

export const DEMO_ASSIGNMENT_GRADES: Record<string, DemoAssignmentGradeRecord> = Object.fromEntries(
  SYNTHETIC_ASSIGNMENT_SETS.flatMap((set) =>
    set.submissions
      .filter((submission) => submission.grade)
      .map((submission) => [
        submission.id,
        {
          id: submission.grade!.id,
          submission_id: submission.id,
          ai_score: submission.grade!.aiScore,
          ai_feedback: submission.grade!.aiFeedback,
          ai_breakdown: submission.grade!.aiBreakdown.map((item) => ({
            criterion: item.criterion,
            score: item.score,
            max_score: item.maxScore,
            feedback: item.feedback,
            confidence_score: item.confidenceScore,
            evidence_snippet: item.evidenceSnippet,
            rubric_expectation: item.rubricExpectation,
            improvement_actions: item.improvementActions,
            review_required: item.reviewRequired,
            error_type: item.errorType,
          })),
          assignment_type: submission.grade!.assignmentType,
          grading_confidence: submission.grade!.gradingConfidence,
          grading_metadata: submission.grade!.gradingMetadata
            ? {
                fairness_notes: submission.grade!.gradingMetadata.fairnessNotes,
                math_analysis: submission.grade!.gradingMetadata.mathAnalysis
                  ? {
                      solver_signals: submission.grade!.gradingMetadata.mathAnalysis.solverSignals,
                    }
                  : null,
              }
            : null,
          lecturer_score: submission.grade!.lecturerScore,
          lecturer_feedback: submission.grade!.lecturerFeedback,
          final_score: submission.grade!.finalScore,
          final_feedback: submission.grade!.finalFeedback,
        } satisfies DemoAssignmentGradeRecord,
      ]),
  ),
);

export const DEMO_ASSIGNMENT_INTEGRITY_SUMMARIES: Record<string, string> = Object.fromEntries(
  SYNTHETIC_ASSIGNMENT_SETS.filter((set) => set.integritySummary).map((set) => [set.id, set.integritySummary as string]),
);

export const DEMO_ASSIGNMENT_INTEGRITY_FLAGS: Record<string, AcademicIntegrityFlag[]> = Object.fromEntries(
  SYNTHETIC_ASSIGNMENT_SETS.filter((set) => set.integrityFlags).map((set) => [set.id, set.integrityFlags as AcademicIntegrityFlag[]]),
);

export const getDemoAssignmentById = (assignmentId: string) =>
  DEMO_ASSIGNMENTS.find((assignment) => assignment.id === assignmentId) ?? null;

export const getDemoAssignmentSetById = getSyntheticAssignmentSetById;
