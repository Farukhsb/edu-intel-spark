import { supabase } from "@/integrations/supabase/client";
import { fetchStudentGradeProjectionFallbackDataset } from "@/lib/data/academic";
import { safeParseGradeBreakdown } from "@/lib/schemas/aiResponses";

export interface StudentGradeProjectionRow {
  submission_id: string;
  assignment_id: string;
  assignment_title: string | null;
  module_code: string | null;
  max_score: number | null;
  file_name: string;
  file_url: string;
  submission_status: string;
  submitted_at: string;
  final_score: number | null;
  ai_score: number | null;
  final_feedback: string | null;
  ai_feedback: string | null;
  ai_breakdown: Array<{
    criterion: string;
    score: number;
    max_score: number;
    feedback?: string;
    comment?: string;
  }> | null;
}

const toStudentGradeBreakdown = (
  value: unknown,
): StudentGradeProjectionRow["ai_breakdown"] => {
  const parsed = safeParseGradeBreakdown(value);
  return parsed.success
    ? parsed.data.map((item) => ({
        criterion: item.criterion,
        score: item.score,
        max_score: item.max_score,
        feedback: item.feedback,
        comment: item.comment,
      }))
    : null;
};

const sanitizeGradeVisibility = <T extends {
  submission_status: string;
  final_score: number | null;
  ai_score: number | null;
  final_feedback: string | null;
  ai_feedback: string | null;
  ai_breakdown: StudentGradeProjectionRow["ai_breakdown"];
}>(row: T): T => {
  if (row.submission_status === "released") {
    return row;
  }

  return {
    ...row,
    final_score: null,
    ai_score: null,
    final_feedback: null,
    ai_feedback: null,
    ai_breakdown: null,
  };
};

const buildProjectionFromFallbackRows = ({
  submissions,
  grades,
  assignments,
}: {
  submissions: Array<{
    id: string;
    assignment_id: string;
    file_name: string;
    file_url: string;
    status: string;
    submitted_at: string;
  }>;
  grades: Array<{
    submission_id: string;
    final_score: number | null;
    ai_score: number | null;
    final_feedback: string | null;
    ai_feedback: string | null;
    ai_breakdown: unknown;
  }>;
  assignments: Array<{
    id: string;
    title: string | null;
    module_code: string | null;
    max_score: number | null;
  }>;
}): StudentGradeProjectionRow[] => {
  const gradeMap = new Map(grades.map((grade) => [grade.submission_id, grade]));
  const assignmentMap = new Map(assignments.map((assignment) => [assignment.id, assignment]));

  return submissions.map((submission) => {
    const grade = gradeMap.get(submission.id);
    const assignment = assignmentMap.get(submission.assignment_id);

    return sanitizeGradeVisibility({
      submission_id: submission.id,
      assignment_id: submission.assignment_id,
      assignment_title: assignment?.title ?? null,
      module_code: assignment?.module_code ?? null,
      max_score: assignment?.max_score ?? null,
      file_name: submission.file_name,
      file_url: submission.file_url,
      submission_status: submission.status,
      submitted_at: submission.submitted_at,
      final_score: grade?.final_score ?? null,
      ai_score: grade?.ai_score ?? null,
      final_feedback: grade?.final_feedback ?? null,
      ai_feedback: grade?.ai_feedback ?? null,
      ai_breakdown: toStudentGradeBreakdown(grade?.ai_breakdown ?? null),
    });
  });
};

const fetchStudentGradeProjectionFallback = async (userId?: string) => {
  const fallback = await fetchStudentGradeProjectionFallbackDataset(userId);
  if (fallback.error) {
    return {
      data: [] as StudentGradeProjectionRow[],
      error: fallback.error,
    };
  }
  if (fallback.submissions.length === 0) {
    return {
      data: [] as StudentGradeProjectionRow[],
      error: null,
    };
  }

  return {
    data: buildProjectionFromFallbackRows({
      submissions: fallback.submissions,
      grades: fallback.grades,
      assignments: fallback.assignments,
    }),
    error: null,
  };
};

export const fetchStudentGradeProjection = async (userId?: string) => {
  const { data, error } = await supabase.rpc("get_student_submission_grade_projection");
  if (!error) {
    return {
      data: ((data || []) as StudentGradeProjectionRow[]).map((row) =>
        sanitizeGradeVisibility({
          ...row,
          ai_breakdown: toStudentGradeBreakdown(row.ai_breakdown),
        }),
      ),
      error: null,
    };
  }

  const fallback = await fetchStudentGradeProjectionFallback(userId);
  return {
    data: fallback.data,
    error: fallback.error,
  };
};
