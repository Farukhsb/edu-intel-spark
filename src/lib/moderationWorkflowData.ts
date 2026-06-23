import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, TablesInsert } from "@/integrations/supabase/types";
import { canReleaseStatus, getApprovalBlockReason } from "@/lib/assessmentWorkflow";
import { fetchModerationCaseViewDataset } from "@/lib/data/moderation";
import type {
  AssignmentRow,
  GradeAuditRow,
  GradeRow,
  IntegrityReviewRow,
  ModerationCaseRow,
  ModerationCaseView,
  ModerationOwnerAssignmentSummary,
  ModerationReviewRow,
  ProfileRow,
  SubmissionRow,
} from "@/lib/moderationWorkflowTypes";

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
  previousValues?: Json;
  newValues?: Json;
  reason?: string | null;
}

const toMap = <T extends { id: string }>(rows: T[]) => new Map(rows.map((row) => [row.id, row]));
const coerceSubmissionStatus = (value: string): SubmissionRow["status"] =>
  value as SubmissionRow["status"];

export const getModerationQueueStats = (cases: ModerationCaseView[]) => ({
  pending: cases.filter((item) => item.moderationCase.status === "moderation_pending").length,
  inProgress: cases.filter((item) => item.moderationCase.status === "moderation_in_progress").length,
  moderated: cases.filter((item) => item.moderationCase.status === "moderated").length,
  escalated: cases.filter((item) => item.moderationCase.status === "escalated").length,
});

export const getModerationOwnerAssignmentSummaries = (
  cases: ModerationCaseView[],
  userId: string | null | undefined,
): ModerationOwnerAssignmentSummary[] => {
  if (!userId) return [];

  const summaries = new Map<string, ModerationOwnerAssignmentSummary>();

  for (const item of cases) {
    if (item.moderationCase.lecturer_id !== userId) continue;

    const releaseState = getModerationReleaseState({
      moderationCase: item.moderationCase,
      submissionStatus: item.submission?.status ?? coerceSubmissionStatus(item.moderationCase.status),
    });
    const approvedReadyCount = releaseState.tone === "ready" ? 1 : 0;
    const escalatedCount = item.moderationCase.status === "escalated" ? 1 : 0;

    if (approvedReadyCount === 0 && escalatedCount === 0) continue;

    const assignmentId = item.assignment?.id || item.moderationCase.assignment_id;
    const current = summaries.get(assignmentId) || {
      assignmentId,
      assignmentTitle: item.assignment?.title || "Assignment",
      approvedReadyCount: 0,
      escalatedCount: 0,
    };

    current.approvedReadyCount += approvedReadyCount;
    current.escalatedCount += escalatedCount;
    summaries.set(assignmentId, current);
  }

  return [...summaries.values()].sort((left, right) => {
    if (right.escalatedCount !== left.escalatedCount) return right.escalatedCount - left.escalatedCount;
    if (right.approvedReadyCount !== left.approvedReadyCount) return right.approvedReadyCount - left.approvedReadyCount;
    return left.assignmentTitle.localeCompare(right.assignmentTitle);
  });
};

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
  payload: TablesInsert<"grade_audit_log">,
) {
  const { error } = await supabase.from("grade_audit_log").insert(payload);
  return { error };
}

export async function upsertModerationCase(
  supabase: SupabaseClient<Database>,
  payload: TablesInsert<"moderation_cases">,
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
  supabase: SupabaseClient<Database>,
  lecturerId: string,
): Promise<{ cases: ModerationCaseView[]; lecturers: ProfileRow[] }> {
  const dataset = await fetchModerationCaseViewDataset(supabase, lecturerId);
  const moderationCases = dataset.moderationCases as ModerationCaseRow[];
  const lecturers = dataset.lecturers as ProfileRow[];

  if (moderationCases.length === 0) {
    return { cases: [], lecturers };
  }

  const submissionsById = toMap(dataset.submissions as SubmissionRow[]);
  const assignmentsById = toMap(dataset.assignments as AssignmentRow[]);
  const gradesById = toMap(dataset.grades as GradeRow[]);
  const profilesById = toMap(dataset.profiles as ProfileRow[]);
  const integrityBySubmission = new Map(
    (dataset.integrityReviews as IntegrityReviewRow[]).map((row) => [row.submission_id, row] as const),
  );
  const reviewsByCase = new Map<string, ModerationReviewRow[]>();
  for (const review of dataset.moderationReviews as ModerationReviewRow[]) {
    const current = reviewsByCase.get(review.moderation_case_id) || [];
    current.push(review);
    reviewsByCase.set(review.moderation_case_id, current);
  }
  const auditBySubmission = new Map<string, GradeAuditRow[]>();
  for (const entry of dataset.auditLog as GradeAuditRow[]) {
    const current = auditBySubmission.get(entry.submission_id) || [];
    current.push(entry);
    auditBySubmission.set(entry.submission_id, current);
  }

  const cases: ModerationCaseView[] = moderationCases.map((moderationCase) => ({
    moderationCase,
    submission: submissionsById.get(moderationCase.submission_id) || null,
    grade: moderationCase.grade_id ? gradesById.get(moderationCase.grade_id) || null : null,
    assignment: assignmentsById.get(moderationCase.assignment_id) || null,
    firstMarker: moderationCase.first_marker_id ? profilesById.get(moderationCase.first_marker_id) || null : null,
    moderator: moderationCase.moderator_id ? profilesById.get(moderationCase.moderator_id) || null : null,
    integrityReview: integrityBySubmission.get(moderationCase.submission_id) || null,
    reviews: reviewsByCase.get(moderationCase.id) || [],
    auditLog: auditBySubmission.get(moderationCase.submission_id) || [],
  }));

  return { cases, lecturers };
}

export const getModerationReleaseState = ({
  moderationCase,
  submissionStatus,
}: {
  moderationCase: ModerationCaseRow;
  submissionStatus: SubmissionRow["status"];
}) => {
  if (canReleaseStatus(submissionStatus)) {
    return {
      tone: "ready" as const,
      badge: "Ready for release",
      detail: "This case has owner approval and can now be released to the student from the assignment workflow.",
    };
  }

  if (submissionStatus === "released") {
    return {
      tone: "released" as const,
      badge: "Released to student",
      detail: "This moderated outcome has already been released to the student.",
    };
  }

  const blockReason = getApprovalBlockReason({
    status: submissionStatus,
    needsModeration: true,
  });

  if (blockReason === "moderation_in_progress") {
    return {
      tone: "blocked" as const,
      badge: "Release blocked",
      detail: "This case cannot be approved or released while moderation is still active or escalated.",
    };
  }

  return {
    tone: "approval" as const,
    badge: "Owner approval required",
    detail: "This case is moderated but still needs assignment-owner approval before any grade release.",
  };
};
