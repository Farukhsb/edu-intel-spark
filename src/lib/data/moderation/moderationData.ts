import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const unique = <T>(values: T[]) => Array.from(new Set(values));

export async function fetchModerationCaseViewDataset(
  supabase: SupabaseClient<Database>,
  lecturerId: string,
) {
  const [{ data: moderationCases, error: caseError }, { data: lecturers, error: lecturerError }] =
    await Promise.all([
      supabase
        .from("moderation_cases")
        .select("*")
        .or(`lecturer_id.eq.${lecturerId},moderator_id.eq.${lecturerId}`)
        .order("updated_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("role", "lecturer"),
    ]);

  if (caseError) throw caseError;
  if (lecturerError) throw lecturerError;

  const moderationCaseRows = moderationCases || [];

  if (moderationCaseRows.length === 0) {
    return {
      moderationCases: [],
      lecturers: lecturers || [],
      submissions: [],
      assignments: [],
      grades: [],
      profiles: [],
      integrityReviews: [],
      moderationReviews: [],
      auditLog: [],
    };
  }

  const submissionIds = moderationCaseRows.map((item) => item.submission_id);
  const assignmentIds = unique(moderationCaseRows.map((item) => item.assignment_id));
  const gradeIds = moderationCaseRows.map((item) => item.grade_id).filter(Boolean) as string[];
  const profileIds = unique(
    moderationCaseRows.flatMap((item) => [item.first_marker_id, item.moderator_id].filter(Boolean) as string[]),
  );
  const caseIds = moderationCaseRows.map((item) => item.id);

  const [
    { data: submissions, error: submissionError },
    { data: assignments, error: assignmentError },
    gradeResult,
    profileResult,
    { data: integrityReviews, error: integrityError },
    { data: moderationReviews, error: reviewError },
    { data: auditLog, error: auditError },
  ] = await Promise.all([
    supabase.from("submissions").select("*").in("id", submissionIds),
    supabase.from("assignments").select("*").in("id", assignmentIds),
    gradeIds.length > 0
      ? supabase.from("grades").select("*").in("id", gradeIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length > 0
      ? supabase.from("profiles").select("*").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("academic_integrity_reviews").select("*").in("submission_id", submissionIds),
    supabase.from("moderation_reviews").select("*").in("moderation_case_id", caseIds).order("created_at", { ascending: false }),
    supabase.from("grade_audit_log").select("*").in("submission_id", submissionIds).order("created_at", { ascending: false }),
  ]);

  if (submissionError) throw submissionError;
  if (assignmentError) throw assignmentError;
  if (gradeResult.error) throw gradeResult.error;
  if (profileResult.error) throw profileResult.error;
  if (integrityError) throw integrityError;
  if (reviewError) throw reviewError;
  if (auditError) throw auditError;

  return {
    moderationCases: moderationCaseRows,
    lecturers: lecturers || [],
    submissions: submissions || [],
    assignments: assignments || [],
    grades: gradeResult.data || [],
    profiles: profileResult.data || [],
    integrityReviews: integrityReviews || [],
    moderationReviews: moderationReviews || [],
    auditLog: auditLog || [],
  };
}
