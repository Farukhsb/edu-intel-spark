import { supabase } from "@/integrations/supabase/client";

const STUDENT_PROFILE_ASSIGNMENT_FIELDS = "id, title, module_code, due_date, max_score";
const STUDENT_PROFILE_SUBMISSION_FIELDS =
  "id, assignment_id, student_id, student_name, student_email, status, submitted_at";
const STUDENT_PROFILE_GRADE_FIELDS = "submission_id, ai_score, final_score";

const PERFORMANCE_ASSIGNMENT_FIELDS = "id, title, module_code";
const PERFORMANCE_SUBMISSION_FIELDS = "id, assignment_id, student_id, student_name, student_email, submitted_at";
const PERFORMANCE_GRADE_FIELDS = "submission_id, ai_score, final_score";

export const fetchLecturerStudentProfileDataset = async (lecturerId: string) => {
  const { data: assignments, error: assignmentsError } = await supabase
    .from("assignments")
    .select(STUDENT_PROFILE_ASSIGNMENT_FIELDS)
    .eq("lecturer_id", lecturerId);

  if (assignmentsError) throw assignmentsError;

  const assignmentRows = assignments || [];
  const assignmentIds = assignmentRows.map((assignment) => assignment.id);

  if (assignmentIds.length === 0) {
    return {
      assignments: [],
      submissions: [],
      grades: [],
    };
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from("submissions")
    .select(STUDENT_PROFILE_SUBMISSION_FIELDS)
    .in("assignment_id", assignmentIds);

  if (submissionsError) throw submissionsError;

  const submissionRows = submissions || [];
  const submissionIds = submissionRows.map((submission) => submission.id);

  if (submissionIds.length === 0) {
    return {
      assignments: assignmentRows,
      submissions: submissionRows,
      grades: [],
    };
  }

  const { data: grades, error: gradesError } = await supabase
    .from("grades")
    .select(STUDENT_PROFILE_GRADE_FIELDS)
    .in("submission_id", submissionIds);

  if (gradesError) throw gradesError;

  return {
    assignments: assignmentRows,
    submissions: submissionRows,
    grades: grades || [],
  };
};

export const fetchLecturerPerformanceDataset = async (lecturerId: string) => {
  const { data: assignments, error: assignmentsError } = await supabase
    .from("assignments")
    .select(PERFORMANCE_ASSIGNMENT_FIELDS)
    .eq("lecturer_id", lecturerId);

  if (assignmentsError) throw assignmentsError;

  const assignmentRows = assignments || [];
  const assignmentIds = assignmentRows.map((assignment) => assignment.id);

  if (assignmentIds.length === 0) {
    return {
      assignments: [],
      submissions: [],
      grades: [],
    };
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from("submissions")
    .select(PERFORMANCE_SUBMISSION_FIELDS)
    .in("assignment_id", assignmentIds);

  if (submissionsError) throw submissionsError;

  const submissionRows = submissions || [];
  const submissionIds = submissionRows.map((submission) => submission.id);

  if (submissionIds.length === 0) {
    return {
      assignments: assignmentRows,
      submissions: submissionRows,
      grades: [],
    };
  }

  const { data: grades, error: gradesError } = await supabase
    .from("grades")
    .select(PERFORMANCE_GRADE_FIELDS)
    .in("submission_id", submissionIds);

  if (gradesError) throw gradesError;

  return {
    assignments: assignmentRows,
    submissions: submissionRows,
    grades: grades || [],
  };
};
