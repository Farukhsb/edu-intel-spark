import { supabase } from "@/integrations/supabase/client";
import type {
  ExternalExaminerAssignmentRow,
  ExternalExaminerGradeRow,
  ExternalExaminerProfileRow,
  ExternalExaminerSubmissionRow,
} from "@/types/academic";
import type { StudentGradeProjectionRow } from "@/lib/studentGradeProjection";

const ACCREDITATION_ASSIGNMENT_FIELDS = "id, title, module_code, due_date, description, rubric";
const ACCREDITATION_SUBMISSION_FIELDS = "id, assignment_id, submitted_at, status";
const ACCREDITATION_GRADE_FIELDS =
  "submission_id, ai_score, final_score, ai_feedback, lecturer_score, reviewed_by, created_at, reviewed_at";
const ACCREDITATION_PROFILE_FIELDS = "id, role";

const PROGRAMME_ASSIGNMENT_FIELDS = "id, title, module_code";
const PROGRAMME_SUBMISSION_FIELDS = "id, assignment_id";
const PROGRAMME_GRADE_FIELDS = "submission_id, ai_score, final_score, lecturer_score";
const PROGRAMME_PROFILE_FIELDS = "id, role";

const EXTERNAL_EXAMINER_ASSIGNMENT_FIELDS = "id, title, module_code";
const EXTERNAL_EXAMINER_SUBMISSION_FIELDS =
  "id, assignment_id, student_id, student_name, student_email, status, submitted_at";
const EXTERNAL_EXAMINER_GRADE_FIELDS =
  "submission_id, ai_score, lecturer_score, final_score, grade_source, ai_feedback, lecturer_feedback, final_feedback, reviewed_at, reviewed_by";
const EXTERNAL_EXAMINER_GRADE_FIELDS_NO_SOURCE =
  "submission_id, ai_score, lecturer_score, final_score, ai_feedback, lecturer_feedback, final_feedback, reviewed_at, reviewed_by";
const EXTERNAL_EXAMINER_PROFILE_FIELDS = "id, full_name, email";

const STUDENT_GRADE_SUBMISSION_FIELDS = "id, assignment_id, file_name, file_url, status, submitted_at, student_id";
const STUDENT_GRADE_GRADE_FIELDS =
  "submission_id, final_score, ai_score, final_feedback, ai_feedback, ai_breakdown";
const STUDENT_GRADE_ASSIGNMENT_FIELDS = "id, title, module_code, max_score";

type ExternalExaminerDatasetStage = "assignments" | "submissions" | "grades" | "profiles";

export class ExternalExaminerDatasetError extends Error {
  stage: ExternalExaminerDatasetStage;
  cause?: unknown;

  constructor(stage: ExternalExaminerDatasetStage, cause: unknown) {
    super(`Failed to load external examiner ${stage}`);
    this.name = "ExternalExaminerDatasetError";
    this.stage = stage;
    this.cause = cause;
  }
}

const isGradeSourceLookupError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;

  const value = error as { message?: string };
  return /grade_source|column|schema/i.test(value.message ?? "");
};

const requireInstitutionId = (institutionId?: string | null) => {
  if (!institutionId) {
    throw new Error("Institution context is required for export data.");
  }

  return institutionId;
};

export const fetchAccreditationDataset = async (institutionId?: string | null) => {
  const scopedInstitutionId = requireInstitutionId(institutionId);
  const [
    { data: grades, error: gradesError },
    { data: submissions, error: submissionsError },
    { data: assignments, error: assignmentsError },
    { data: profiles, error: profilesError },
  ] = await Promise.all([
    supabase.from("grades").select(ACCREDITATION_GRADE_FIELDS).eq("institution_id", scopedInstitutionId),
    supabase.from("submissions").select(ACCREDITATION_SUBMISSION_FIELDS).eq("institution_id", scopedInstitutionId),
    supabase.from("assignments").select(ACCREDITATION_ASSIGNMENT_FIELDS).eq("institution_id", scopedInstitutionId),
    supabase.from("profiles").select(ACCREDITATION_PROFILE_FIELDS).eq("institution_id", scopedInstitutionId),
  ]);

  if (gradesError) throw gradesError;
  if (submissionsError) throw submissionsError;
  if (assignmentsError) throw assignmentsError;
  if (profilesError) throw profilesError;

  return {
    grades: grades || [],
    submissions: submissions || [],
    assignments: assignments || [],
    profiles: profiles || [],
  };
};

export const fetchProgrammeReportDataset = async (institutionId?: string | null) => {
  const scopedInstitutionId = requireInstitutionId(institutionId);
  const [
    { data: assignments, error: assignmentsError },
    { data: submissions, error: submissionsError },
    { data: grades, error: gradesError },
    { data: profiles, error: profilesError },
  ] = await Promise.all([
    supabase.from("assignments").select(PROGRAMME_ASSIGNMENT_FIELDS).eq("institution_id", scopedInstitutionId),
    supabase.from("submissions").select(PROGRAMME_SUBMISSION_FIELDS).eq("institution_id", scopedInstitutionId),
    supabase.from("grades").select(PROGRAMME_GRADE_FIELDS).eq("institution_id", scopedInstitutionId),
    supabase.from("profiles").select(PROGRAMME_PROFILE_FIELDS).eq("institution_id", scopedInstitutionId),
  ]);

  if (assignmentsError) throw assignmentsError;
  if (submissionsError) throw submissionsError;
  if (gradesError) throw gradesError;
  if (profilesError) throw profilesError;

  return {
    assignments: assignments || [],
    submissions: submissions || [],
    grades: grades || [],
    profiles: profiles || [],
  };
};

export const fetchExternalExaminerDataset = async (institutionId?: string | null) => {
  const scopedInstitutionId = requireInstitutionId(institutionId);
  const stages: Array<{
    key: ExternalExaminerDatasetStage;
    promise: PromiseLike<{ data: unknown[] | null; error: unknown | null }>;
  }> = [
    {
      key: "assignments",
      promise: supabase.from("assignments").select(EXTERNAL_EXAMINER_ASSIGNMENT_FIELDS).eq("institution_id", scopedInstitutionId),
    },
    {
      key: "submissions",
      promise: supabase.from("submissions").select(EXTERNAL_EXAMINER_SUBMISSION_FIELDS).eq("institution_id", scopedInstitutionId),
    },
    {
      key: "grades",
      promise: supabase.from("grades").select(EXTERNAL_EXAMINER_GRADE_FIELDS).eq("institution_id", scopedInstitutionId),
    },
    {
      key: "profiles",
      promise: supabase.from("profiles").select(EXTERNAL_EXAMINER_PROFILE_FIELDS).eq("institution_id", scopedInstitutionId),
    },
  ];

  const results = await Promise.allSettled(stages.map((stage) => stage.promise));

  const gradesStageIndex = stages.findIndex((stage) => stage.key === "grades");
  const gradesStageResult = results[gradesStageIndex];
  if (
    gradesStageResult?.status === "fulfilled" &&
    gradesStageResult.value.error &&
    isGradeSourceLookupError(gradesStageResult.value.error)
  ) {
    const fallbackGrades = await supabase
      .from("grades")
      .select(EXTERNAL_EXAMINER_GRADE_FIELDS_NO_SOURCE)
      .eq("institution_id", scopedInstitutionId);
    if (fallbackGrades.error) {
      throw new ExternalExaminerDatasetError("grades", fallbackGrades.error);
    }

    results[gradesStageIndex] = {
      status: "fulfilled",
      value: {
        data: fallbackGrades.data,
        error: null,
      },
    };
  }

  for (const [index, result] of results.entries()) {
    const stage = stages[index].key;
    if (result.status === "rejected") {
      throw new ExternalExaminerDatasetError(stage, result.reason);
    }
    if (result.value.error) {
      throw new ExternalExaminerDatasetError(stage, result.value.error);
    }
  }

  const normalizedResults: Array<{ data: unknown[] | null; error: unknown | null }> = results.map((result) =>
    result.status === "fulfilled" ? result.value : { data: null, error: null },
  );
  const [assignmentsResult, submissionsResult, gradesResult, profilesResult] = normalizedResults;

  return {
    assignments: (assignmentsResult.data ?? []) as ExternalExaminerAssignmentRow[],
    submissions: (submissionsResult.data ?? []) as ExternalExaminerSubmissionRow[],
    grades: (gradesResult.data ?? []) as unknown as ExternalExaminerGradeRow[],
    profiles: (profilesResult.data ?? []) as ExternalExaminerProfileRow[],
  };
};

export const fetchStudentGradeProjectionFallbackDataset = async (userId?: string) => {
  const submissionsQuery = supabase.from("submissions").select(STUDENT_GRADE_SUBMISSION_FIELDS);
  const submissionsResponse = userId ? await submissionsQuery.eq("student_id", userId) : await submissionsQuery;

  if (submissionsResponse.error) {
    return {
      submissions: [] as Array<{
        id: string;
        assignment_id: string;
        file_name: string;
        file_url: string;
        status: string;
        submitted_at: string;
      }>,
      grades: [] as Array<{
        submission_id: string;
        final_score: number | null;
        ai_score: number | null;
        final_feedback: string | null;
        ai_feedback: string | null;
        ai_breakdown: StudentGradeProjectionRow["ai_breakdown"];
      }>,
      assignments: [] as Array<{
        id: string;
        title: string | null;
        module_code: string | null;
        max_score: number | null;
      }>,
      error: submissionsResponse.error,
    };
  }

  const submissions = submissionsResponse.data ?? [];
  if (submissions.length === 0) {
    return {
      submissions: [] as Array<{
        id: string;
        assignment_id: string;
        file_name: string;
        file_url: string;
        status: string;
        submitted_at: string;
      }>,
      grades: [],
      assignments: [],
      error: null,
    };
  }

  const submissionIds = submissions.map((submission) => submission.id);
  const assignmentIds = [...new Set(submissions.map((submission) => submission.assignment_id))];

  const [gradesResponse, assignmentsResponse] = await Promise.all([
    supabase.from("grades").select(STUDENT_GRADE_GRADE_FIELDS).in("submission_id", submissionIds),
    supabase.from("assignments").select(STUDENT_GRADE_ASSIGNMENT_FIELDS).in("id", assignmentIds),
  ]);

  if (gradesResponse.error) {
    return {
      submissions,
      grades: [],
      assignments: [],
      error: gradesResponse.error,
    };
  }

  if (assignmentsResponse.error) {
    return {
      submissions,
      grades: [],
      assignments: [],
      error: assignmentsResponse.error,
    };
  }

  return {
    submissions,
    grades: gradesResponse.data ?? [],
    assignments: assignmentsResponse.data ?? [],
    error: null,
  };
};
