import { supabase } from "@/integrations/supabase/client";

const ASSIGNMENT_FIELDS = "id, title, module_code";
const SUBMISSION_FIELDS = "id, assignment_id";
const GRADE_FIELDS = "submission_id, ai_score, final_score";

export const fetchInstitutionalInsightsDataset = async (lecturerId: string) => {
  const { data: assignments, error: assignmentsError } = await supabase
    .from("assignments")
    .select(ASSIGNMENT_FIELDS)
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
    .select(SUBMISSION_FIELDS)
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
    .select(GRADE_FIELDS)
    .in("submission_id", submissionIds);

  if (gradesError) throw gradesError;

  return {
    assignments: assignmentRows,
    submissions: submissionRows,
    grades: grades || [],
  };
};
