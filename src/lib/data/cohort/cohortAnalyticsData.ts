import { supabase } from "@/integrations/supabase/client";

const ASSIGNMENT_FIELDS = "id, title, module_code, created_at, max_score";
const SUBMISSION_FIELDS =
  "id, assignment_id, student_id, student_name, student_email, status, submitted_at";
const GRADE_FIELDS = "submission_id, ai_score, final_score, ai_breakdown";
const INTEGRITY_REVIEW_FIELDS = "submission_id, decision, lecturer_note, updated_at";

export const fetchCohortAnalyticsDataset = async (lecturerId: string) => {
  const { data: assignments, error: assignmentsError } = await supabase
    .from("assignments")
    .select(ASSIGNMENT_FIELDS)
    .eq("lecturer_id", lecturerId)
    .order("created_at", { ascending: true });

  if (assignmentsError) throw assignmentsError;

  const assignmentRows = assignments || [];
  const assignmentIds = assignmentRows.map((assignment) => assignment.id);

  if (assignmentIds.length === 0) {
    return {
      assignments: [],
      submissions: [],
      grades: [],
      integrityReviews: [],
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
      integrityReviews: [],
    };
  }

  const [{ data: grades, error: gradesError }, { data: integrityReviews, error: integrityError }] = await Promise.all([
    supabase.from("grades").select(GRADE_FIELDS).in("submission_id", submissionIds),
    supabase
      .from("academic_integrity_reviews")
      .select(INTEGRITY_REVIEW_FIELDS)
      .eq("lecturer_id", lecturerId)
      .in("submission_id", submissionIds),
  ]);

  if (gradesError) throw gradesError;
  if (integrityError) throw integrityError;

  return {
    assignments: assignmentRows,
    submissions: submissionRows,
    grades: grades || [],
    integrityReviews: integrityReviews || [],
  };
};
