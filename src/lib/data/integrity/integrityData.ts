import { supabase } from "@/integrations/supabase/client";

const ASSIGNMENT_FIELDS = "id, title";
const SUBMISSION_FIELDS = "id, assignment_id, student_name, student_email, status, submitted_at";
const REVIEW_FIELDS = "submission_id, decision, evidence_summary, lecturer_note, updated_at";

export const fetchAcademicIntegrityDataset = async (lecturerId: string) => {
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
      reviews: [],
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
      reviews: [],
    };
  }

  const { data: reviews, error: reviewsError } = await supabase
    .from("academic_integrity_reviews")
    .select(REVIEW_FIELDS)
    .eq("lecturer_id", lecturerId)
    .in("submission_id", submissionIds);

  if (reviewsError) throw reviewsError;

  return {
    assignments: assignmentRows,
    submissions: submissionRows,
    reviews: reviews || [],
  };
};
