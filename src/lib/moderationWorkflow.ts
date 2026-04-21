import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables, TablesInsert } from "@/integrations/supabase/types";
import type { ModerationAction } from "@/lib/moderation";

export type ModerationCaseRow = Tables<"moderation_cases">;
export type SubmissionRow = Tables<"submissions">;
export type GradeRow = Tables<"grades">;
export type AssignmentRow = Tables<"assignments">;
export type ModerationReviewRow = Tables<"moderation_reviews">;
export type GradeAuditRow = Tables<"grade_audit_log">;
export type ProfileRow = Tables<"profiles">;
export type IntegrityReviewRow = Tables<"academic_integrity_reviews">;

export interface ModerationCaseView {
  moderationCase: ModerationCaseRow;
  submission: SubmissionRow;
  grade: GradeRow | null;
  assignment: AssignmentRow | null;
  firstMarker: ProfileRow | null;
  moderator: ProfileRow | null;
  integrityReview: IntegrityReviewRow | null;
  reviews: ModerationReviewRow[];
  auditLog: GradeAuditRow[];
}

interface FetchModerationCaseViewsResult {
  cases: ModerationCaseView[];
  lecturers: ProfileRow[];
}

interface ModerationCasePayloadInput {
  submissionId: string;
  assignmentId: string;
  gradeId: string;
  lecturerId: string;
  firstMarkerId: string;
  status: ModerationCaseRow["status"];
  aiScoreSnapshot: number | null;
  firstMarkerScore: number | null;
  triggerFlags: string[];
  triggerSummary: string | null;
  confidenceScore: number | null;
  integrityRiskScore: number | null;
  existingCase?: ModerationCaseRow | null;
}

interface ModerationAuditPayloadInput {
  submissionId: string;
  changedBy: string;
  eventType: string;
  actorRole: string;
  gradeId?: string | null;
  moderationCaseId?: string | null;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason?: string | null;
}

interface ModerationActionPlanInput {
  action: ModerationAction;
  moderationCase: ModerationCaseRow;
  submissionStatus: SubmissionRow["status"];
  grade: Pick<
    GradeRow,
    "ai_score" | "ai_feedback" | "lecturer_score" | "lecturer_feedback" | "final_score" | "final_feedback"
  > | null;
  userId: string;
  noteDraft: string;
  scoreDraft: string;
  feedbackDraft: string;
}

const unique = <T>(values: T[]) => Array.from(new Set(values));

const toMap = <T extends { id: string }>(rows: T[]) => new Map(rows.map((row) => [row.id, row]));

export const getModerationQueueStats = (cases: ModerationCaseView[]) => ({
  pending: cases.filter((item) => item.moderationCase.status === "moderation_pending").length,
  inProgress: cases.filter((item) => item.moderationCase.status === "moderation_in_progress").length,
  moderated: cases.filter((item) => item.moderationCase.status === "moderated").length,
  escalated: cases.filter((item) => item.moderationCase.status === "escalated").length,
});

export const buildModerationAuditPayload = ({
  submissionId,
  changedBy,
  eventType,
  actorRole,
  gradeId,
  moderationCaseId,
  previousValues,
  newValues,
  reason,
}: ModerationAuditPayloadInput): TablesInsert<"grade_audit_log"> => ({
  submission_id: submissionId,
  grade_id: gradeId ?? null,
  moderation_case_id: moderationCaseId ?? null,
  changed_by: changedBy,
  event_type: eventType,
  actor_role: actorRole,
  previous_values: previousValues ?? {},
  new_values: newValues ?? {},
  reason: reason ?? null,
});

export const buildModerationCasePayload = ({
  submissionId,
  assignmentId,
  gradeId,
  lecturerId,
  firstMarkerId,
  status,
  aiScoreSnapshot,
  firstMarkerScore,
  triggerFlags,
  triggerSummary,
  confidenceScore,
  integrityRiskScore,
  existingCase,
}: ModerationCasePayloadInput): TablesInsert<"moderation_cases"> => ({
  submission_id: submissionId,
  assignment_id: assignmentId,
  grade_id: gradeId,
  lecturer_id: lecturerId,
  first_marker_id: firstMarkerId,
  moderator_id: existingCase?.moderator_id ?? null,
  status,
  trigger_flags: triggerFlags,
  trigger_summary: triggerSummary,
  confidence_score: confidenceScore,
  integrity_risk_score: integrityRiskScore,
  ai_score_snapshot: aiScoreSnapshot,
  first_marker_score: firstMarkerScore,
  moderator_score: existingCase?.moderator_score ?? null,
  final_agreed_score: existingCase?.final_agreed_score ?? null,
  final_agreed_feedback: existingCase?.final_agreed_feedback ?? null,
  moderated_at: status === "moderated" ? new Date().toISOString() : existingCase?.moderated_at ?? null,
  approved_at: existingCase?.approved_at ?? null,
});

export async function insertModerationAuditEntry(
  supabase: SupabaseClient<Database>,
  payload: TablesInsert<"grade_audit_log">
) {
  const { error } = await supabase.from("grade_audit_log").insert(payload);
  return { error };
}

export async function upsertModerationCase(
  supabase: SupabaseClient<Database>,
  payload: TablesInsert<"moderation_cases">
) {
  const { data, error } = await supabase
    .from("moderation_cases")
    .upsert(payload, { onConflict: "submission_id" })
    .select()
    .single();

  return {
    data: (data as ModerationCaseRow | null) ?? null,
    error,
  };
}

export async function fetchModerationCaseViews(
  supabase: SupabaseClient<Database>
): Promise<FetchModerationCaseViewsResult> {
  const [{ data: moderationCaseRows, error: caseError }, { data: lecturerRows, error: lecturerError }] =
    await Promise.all([
      supabase.from("moderation_cases").select("*").order("updated_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("role", "lecturer"),
    ]);

  if (caseError) throw caseError;
  if (lecturerError) throw lecturerError;

  const moderationCases = (moderationCaseRows || []) as ModerationCaseRow[];
  const lecturers = (lecturerRows || []) as ProfileRow[];

  if (moderationCases.length === 0) {
    return { cases: [], lecturers };
  }

  const submissionIds = moderationCases.map((item) => item.submission_id);
  const assignmentIds = unique(moderationCases.map((item) => item.assignment_id));
  const gradeIds = moderationCases.map((item) => item.grade_id).filter(Boolean) as string[];
  const profileIds = unique(
    moderationCases.flatMap((item) => [item.first_marker_id, item.moderator_id].filter(Boolean) as string[])
  );
  const caseIds = moderationCases.map((item) => item.id);

  const [
    { data: submissionRows, error: submissionError },
    { data: assignmentRows, error: assignmentError },
    gradeResult,
    profileResult,
    { data: integrityRows, error: integrityError },
    { data: reviewRows, error: reviewError },
    { data: auditRows, error: auditError },
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

  const submissionsById = toMap((submissionRows || []) as SubmissionRow[]);
  const assignmentsById = toMap((assignmentRows || []) as AssignmentRow[]);
  const gradesById = toMap((gradeResult.data || []) as GradeRow[]);
  const profilesById = toMap((profileResult.data || []) as ProfileRow[]);
  const integrityBySubmission = new Map(
    ((integrityRows || []) as IntegrityReviewRow[]).map((row) => [row.submission_id, row] as const)
  );
  const reviewsByCase = new Map<string, ModerationReviewRow[]>();
  for (const review of (reviewRows || []) as ModerationReviewRow[]) {
    const current = reviewsByCase.get(review.moderation_case_id) || [];
    current.push(review);
    reviewsByCase.set(review.moderation_case_id, current);
  }
  const auditBySubmission = new Map<string, GradeAuditRow[]>();
  for (const entry of (auditRows || []) as GradeAuditRow[]) {
    const current = auditBySubmission.get(entry.submission_id) || [];
    current.push(entry);
    auditBySubmission.set(entry.submission_id, current);
  }

  const cases = moderationCases
    .map((moderationCase) => {
      const submission = submissionsById.get(moderationCase.submission_id);
      if (!submission) return null;

      return {
        moderationCase,
        submission,
        grade: moderationCase.grade_id ? gradesById.get(moderationCase.grade_id) || null : null,
        assignment: assignmentsById.get(moderationCase.assignment_id) || null,
        firstMarker: moderationCase.first_marker_id ? profilesById.get(moderationCase.first_marker_id) || null : null,
        moderator: moderationCase.moderator_id ? profilesById.get(moderationCase.moderator_id) || null : null,
        integrityReview: integrityBySubmission.get(moderationCase.submission_id) || null,
        reviews: reviewsByCase.get(moderationCase.id) || [],
        auditLog: auditBySubmission.get(moderationCase.submission_id) || [],
      } satisfies ModerationCaseView;
    })
    .filter((item): item is ModerationCaseView => item !== null);

  return { cases, lecturers };
}

const getReviewerRole = (moderationCase: ModerationCaseRow, userId: string) => {
  if (moderationCase.first_marker_id === userId) return "first_marker";
  if (moderationCase.lecturer_id === userId) return "lecturer";
  return "moderator";
};

export const buildModerationActionPlan = ({
  action,
  moderationCase,
  submissionStatus,
  grade,
  userId,
  noteDraft,
  scoreDraft,
  feedbackDraft,
}: ModerationActionPlanInput) => {
  const resolvedScore =
    scoreDraft === ""
      ? moderationCase.final_agreed_score ??
        moderationCase.first_marker_score ??
        grade?.lecturer_score ??
        grade?.ai_score ??
        null
      : Number(scoreDraft);
  const resolvedFeedback =
    feedbackDraft || moderationCase.final_agreed_feedback || grade?.lecturer_feedback || grade?.ai_feedback || null;

  const nextCasePatch: Partial<Tables<"moderation_cases">["Update"]> = {};
  let nextSubmissionStatus: SubmissionRow["status"] = submissionStatus;

  if (action === "agree" || action === "adjust") {
    nextCasePatch.status = "moderated";
    nextCasePatch.moderator_id = moderationCase.moderator_id ?? userId;
    nextCasePatch.moderator_score = resolvedScore;
    nextCasePatch.final_agreed_score = resolvedScore;
    nextCasePatch.final_agreed_feedback = resolvedFeedback;
    nextCasePatch.moderated_at = new Date().toISOString();
    nextSubmissionStatus = "moderated";
  }

  if (action === "return") {
    nextCasePatch.status = "first_review";
    nextSubmissionStatus = "first_review";
  }

  if (action === "escalate") {
    nextCasePatch.status = "escalated";
    nextSubmissionStatus = "escalated";
  }

  if (action === "approve") {
    nextCasePatch.approved_at = new Date().toISOString();
    nextSubmissionStatus = "approved";
  }

  const reviewPayload =
    action === "approve"
      ? null
      : ({
          moderation_case_id: moderationCase.id,
          submission_id: moderationCase.submission_id,
          reviewer_id: userId,
          reviewer_role: getReviewerRole(moderationCase, userId),
          action,
          proposed_score: resolvedScore,
          proposed_feedback: resolvedFeedback,
          notes: noteDraft || null,
          snapshot: {
            ai_score: grade?.ai_score ?? null,
            first_marker_score: moderationCase.first_marker_score ?? grade?.lecturer_score ?? null,
            moderator_score: resolvedScore,
            status_before: moderationCase.status,
            status_after: nextSubmissionStatus,
          },
        } satisfies TablesInsert<"moderation_reviews">);

  return {
    resolvedScore,
    resolvedFeedback,
    nextCasePatch,
    nextSubmissionStatus,
    reviewPayload,
  };
};
