import { supabase } from "@/integrations/supabase/client";

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
  ai_breakdown: Array<{ criterion: string; score: number; max_score: number }> | null;
}

const SUBMISSION_FIELDS = "id, assignment_id, file_name, file_url, status, submitted_at, student_id";
const GRADE_FIELDS = "submission_id, final_score, ai_score, final_feedback, ai_feedback, ai_breakdown";
const ASSIGNMENT_FIELDS = "id, title, module_code, max_score";

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
    ai_breakdown: StudentGradeProjectionRow["ai_breakdown"];
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
      ai_breakdown: grade?.ai_breakdown ?? null,
    });
  });
};

const fetchStudentGradeProjectionFallback = async (userId?: string) => {
  const submissionsQuery = supabase.from("submissions").select(SUBMISSION_FIELDS);
  const submissionsResponse = userId
    ? await submissionsQuery.eq("student_id", userId)
    : await submissionsQuery;

  if (submissionsResponse.error) {
    return {
      data: [] as StudentGradeProjectionRow[],
      error: submissionsResponse.error,
    };
  }

  const submissions = submissionsResponse.data ?? [];
  if (submissions.length === 0) {
    return {
      data: [] as StudentGradeProjectionRow[],
      error: null,
    };
  }

  const submissionIds = submissions.map((submission) => submission.id);
  const assignmentIds = [...new Set(submissions.map((submission) => submission.assignment_id))];

  const [
    gradesResponse,
    assignmentsResponse,
  ] = await Promise.all([
    supabase.from("grades").select(GRADE_FIELDS).in("submission_id", submissionIds),
    supabase.from("assignments").select(ASSIGNMENT_FIELDS).in("id", assignmentIds),
  ]);

  if (gradesResponse.error) {
    return {
      data: [] as StudentGradeProjectionRow[],
      error: gradesResponse.error,
    };
  }

  if (assignmentsResponse.error) {
    return {
      data: [] as StudentGradeProjectionRow[],
      error: assignmentsResponse.error,
    };
  }

  return {
    data: buildProjectionFromFallbackRows({
      submissions,
      grades: gradesResponse.data ?? [],
      assignments: assignmentsResponse.data ?? [],
    }),
    error: null,
  };
};

export const fetchStudentGradeProjection = async (userId?: string) => {
  const { data, error } = await supabase.rpc("get_student_submission_grade_projection");
  if (!error) {
    return {
      data: ((data || []) as StudentGradeProjectionRow[]).map((row) => sanitizeGradeVisibility(row)),
      error: null,
    };
  }

  const fallback = await fetchStudentGradeProjectionFallback(userId);
  return {
    data: fallback.data,
    error: fallback.error,
  };
};
