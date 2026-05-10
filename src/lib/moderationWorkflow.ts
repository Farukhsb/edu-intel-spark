import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { canReleaseStatus, getApprovalBlockReason } from "@/lib/assessmentWorkflow";
import { fetchModerationCaseViewDataset } from "@/lib/data/moderation";
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
  submission: SubmissionRow | null;
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
  previousValues?: Json;
  newValues?: Json;
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

interface ModerationActionPermissionInput {
  action: ModerationAction;
  moderationCase: ModerationCaseRow;
  userId: string | null | undefined;
}

interface ModerationDisagreementInput {
  moderationCase: ModerationCaseRow;
  grade: Pick<GradeRow, "lecturer_score" | "lecturer_feedback"> | null;
  latestModeratorReview: Pick<ModerationReviewRow, "action" | "proposed_score" | "proposed_feedback"> | null;
}

interface ModerationEscalationSummaryInput {
  moderationCase: ModerationCaseRow;
  disagreement: ReturnType<typeof getModerationDisagreementSummary>;
  latestModeratorReview: Pick<ModerationReviewRow, "notes"> | null;
}

interface ModerationReleaseStateInput {
  moderationCase: ModerationCaseRow;
  submissionStatus: SubmissionRow["status"];
}

interface ModerationNextStepInput {
  item: ModerationCaseView;
  userId: string | null | undefined;
}

export type ModerationQueueFilter =
  | "all"
  | "assigned_to_me"
  | "awaiting_my_approval"
  | "escalated"
  | "ready_for_release";

export type ModerationQueueSort = "priority" | "newest" | "student";

export interface ModerationOwnerAssignmentSummary {
  assignmentId: string;
  assignmentTitle: string;
  approvedReadyCount: number;
  escalatedCount: number;
}

export interface ModerationNextStepSummary {
  actor: "moderator" | "owner" | "system" | "senior_review";
  headline: string;
  detail: string;
  tone: "ready" | "warning" | "blocked" | "progress" | "resolved";
}

interface ModerationQueueFilterInput {
  item: ModerationCaseView;
  filter: ModerationQueueFilter;
  userId: string | null | undefined;
}

interface ModerationQueueSearchInput {
  item: ModerationCaseView;
  query: string;
}

interface ModerationBulkAssignEligibilityInput {
  item: ModerationCaseView;
  userId: string | null | undefined;
}

interface ModerationBulkApproveEligibilityInput {
  item: ModerationCaseView;
  userId: string | null | undefined;
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
    if (right.escalatedCount !== left.escalatedCount) {
      return right.escalatedCount - left.escalatedCount;
    }
    if (right.approvedReadyCount !== left.approvedReadyCount) {
      return right.approvedReadyCount - left.approvedReadyCount;
    }
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
  supabase: SupabaseClient<Database>,
  lecturerId: string
): Promise<FetchModerationCaseViewsResult> {
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
    (dataset.integrityReviews as IntegrityReviewRow[]).map((row) => [row.submission_id, row] as const)
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

const getReviewerRole = (moderationCase: ModerationCaseRow, userId: string) => {
  if (moderationCase.first_marker_id === userId) return "first_marker";
  if (moderationCase.lecturer_id === userId) return "lecturer";
  return "moderator";
};

export const canPerformModerationAction = ({
  action,
  moderationCase,
  userId,
}: ModerationActionPermissionInput) => {
  if (!userId) return false;

  if (action === "approve") {
    return moderationCase.lecturer_id === userId && moderationCase.status === "moderated";
  }

  return moderationCase.moderator_id === userId;
};

export const getModerationDisagreementSummary = ({
  moderationCase,
  grade,
  latestModeratorReview,
}: ModerationDisagreementInput) => {
  const baselineScore = moderationCase.first_marker_score ?? grade?.lecturer_score ?? null;
  const moderatorScore =
    latestModeratorReview?.proposed_score ?? moderationCase.moderator_score ?? moderationCase.final_agreed_score ?? null;
  const baselineFeedback = grade?.lecturer_feedback?.trim() || null;
  const moderatorFeedback =
    latestModeratorReview?.proposed_feedback?.trim() ||
    moderationCase.final_agreed_feedback?.trim() ||
    null;

  const scoreChanged =
    typeof baselineScore === "number" &&
    typeof moderatorScore === "number" &&
    Math.abs(baselineScore - moderatorScore) >= 1;
  const feedbackChanged =
    Boolean(moderatorFeedback) &&
    moderatorFeedback !== baselineFeedback;

  const hasMaterialChange = scoreChanged || feedbackChanged;
  let label = "Moderator confirmed the first marker decision.";

  if (scoreChanged && feedbackChanged) {
    label = "Moderator changed both the score and feedback.";
  } else if (scoreChanged) {
    label = "Moderator changed the score.";
  } else if (feedbackChanged) {
    label = "Moderator changed the feedback.";
  }

  return {
    hasMaterialChange,
    scoreChanged,
    feedbackChanged,
    baselineScore,
    moderatorScore,
    label,
  };
};

export const getModerationEscalationSummary = ({
  moderationCase,
  disagreement,
  latestModeratorReview,
}: ModerationEscalationSummaryInput) => {
  const headline = disagreement.hasMaterialChange
    ? "Escalated after the moderator changed the outcome."
    : "Escalated without a material score or feedback change.";

  const resolutionState =
    "This case is still unresolved and needs owner or senior review before final approval.";

  const escalationReason =
    latestModeratorReview?.notes?.trim() || moderationCase.trigger_summary?.trim() || null;

  return {
    headline,
    resolutionState,
    escalationReason,
  };
};

export const getModerationReleaseState = ({
  moderationCase,
  submissionStatus,
}: ModerationReleaseStateInput) => {
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

export const getModerationNextStep = ({
  item,
  userId,
}: ModerationNextStepInput): ModerationNextStepSummary => {
  const submissionStatus = item.submission?.status ?? coerceSubmissionStatus(item.moderationCase.status);
  const releaseState = getModerationReleaseState({
    moderationCase: item.moderationCase,
    submissionStatus,
  });

  if (releaseState.tone === "released") {
    return {
      actor: "system",
      headline: "Released to student",
      detail: "The moderated outcome is already visible to the student. Use the audit trail for any follow-up.",
      tone: "resolved",
    };
  }

  if (item.moderationCase.status === "escalated" || submissionStatus === "escalated") {
    return {
      actor: "senior_review",
      headline: "Escalated dispute needs owner or senior review",
      detail:
        userId && item.moderationCase.lecturer_id === userId
          ? "Review the disagreement, decide whether to rework the mark, and only release after the dispute is closed."
          : "This case is blocked until the assignment owner or a senior reviewer resolves the dispute.",
      tone: "blocked",
    };
  }

  if (!item.moderationCase.moderator_id && item.moderationCase.status === "moderation_pending") {
    return {
      actor: "owner",
      headline: "Assign a moderator",
      detail: "Moderation cannot start until the assignment owner assigns this case to a moderator.",
      tone: "warning",
    };
  }

  if (item.moderationCase.status === "moderation_pending" || item.moderationCase.status === "moderation_in_progress") {
    if (userId && item.moderationCase.moderator_id === userId) {
      return {
        actor: "moderator",
        headline: "Complete the moderation decision",
        detail: "Compare the evidence, record the rationale, and either agree, adjust, return, or escalate the mark.",
        tone: "progress",
      };
    }

    return {
      actor: "moderator",
      headline: "Waiting for moderator review",
      detail: item.moderationCase.moderator_id
        ? "The assigned moderator still needs to complete the case before the owner can approve or release it."
        : "The case is queued for moderation but no moderator has accepted it yet.",
      tone: "progress",
    };
  }

  if (releaseState.tone === "approval") {
    return {
      actor: "owner",
      headline: "Assignment owner approval required",
      detail: "The moderator has finished. The assignment owner now needs to confirm the outcome before release.",
      tone: "warning",
    };
  }

  if (releaseState.tone === "ready") {
    return {
      actor: "owner",
      headline: "Release the approved outcome",
      detail: "Owner approval is complete. Open the assignment release workflow to publish the result to the student.",
      tone: "ready",
    };
  }

  return {
    actor: "system",
    headline: "Moderation follow-up required",
    detail: "Review the latest moderation state and continue the case from the moderation queue.",
    tone: "progress",
  };
};

export const matchesModerationQueueFilter = ({
  item,
  filter,
  userId,
}: ModerationQueueFilterInput) => {
  if (filter === "all") return true;

  if (filter === "assigned_to_me") {
    return Boolean(userId) && item.moderationCase.moderator_id === userId;
  }

  if (filter === "awaiting_my_approval") {
    return (
      Boolean(userId) &&
      item.moderationCase.lecturer_id === userId &&
      getModerationReleaseState({
        moderationCase: item.moderationCase,
        submissionStatus: item.submission?.status ?? coerceSubmissionStatus(item.moderationCase.status),
      }).tone === "approval"
    );
  }

  if (filter === "escalated") {
    return item.moderationCase.status === "escalated" || item.submission?.status === "escalated";
  }

  if (filter === "ready_for_release") {
    return (
      getModerationReleaseState({
        moderationCase: item.moderationCase,
        submissionStatus: item.submission?.status ?? coerceSubmissionStatus(item.moderationCase.status),
      }).tone === "ready"
    );
  }

  return true;
};

export const matchesModerationQueueSearch = ({
  item,
  query,
}: ModerationQueueSearchInput) => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;

  const haystack = [
    item.submission?.student_name,
    item.submission?.student_email,
    item.assignment?.title,
    item.moderator?.full_name,
    item.firstMarker?.full_name,
    item.moderationCase.status,
    item.submission?.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(trimmed);
};

const getModerationPriorityRank = (item: ModerationCaseView) => {
  const releaseState = getModerationReleaseState({
    moderationCase: item.moderationCase,
    submissionStatus: item.submission?.status ?? coerceSubmissionStatus(item.moderationCase.status),
  });

  if (item.moderationCase.status === "escalated") return 0;
  if (releaseState.tone === "approval") return 1;
  if (releaseState.tone === "ready") return 2;
  if (item.moderationCase.status === "moderation_in_progress") return 3;
  if (item.moderationCase.status === "moderation_pending") return 4;
  if (releaseState.tone === "released") return 5;
  return 6;
};

export const sortModerationQueueCases = (
  items: ModerationCaseView[],
  sort: ModerationQueueSort,
) => {
  return [...items].sort((left, right) => {
    if (sort === "student") {
      const leftName = left.submission?.student_name || left.submission?.student_email || "";
      const rightName = right.submission?.student_name || right.submission?.student_email || "";
      return leftName.localeCompare(rightName);
    }

    if (sort === "newest") {
      const leftTime = new Date(left.moderationCase.updated_at).getTime();
      const rightTime = new Date(right.moderationCase.updated_at).getTime();
      return rightTime - leftTime;
    }

    const rankDelta = getModerationPriorityRank(left) - getModerationPriorityRank(right);
    if (rankDelta !== 0) return rankDelta;

    const leftTime = new Date(left.moderationCase.updated_at).getTime();
    const rightTime = new Date(right.moderationCase.updated_at).getTime();
    return rightTime - leftTime;
  });
};

export const canBulkAssignModerator = ({
  item,
  userId,
}: ModerationBulkAssignEligibilityInput) => {
  if (!userId || !item.submission) return false;

  return (
    item.moderationCase.lecturer_id === userId &&
    (item.moderationCase.status === "moderation_pending" ||
      item.moderationCase.status === "moderation_in_progress")
  );
};

export const canBulkApproveModeration = ({
  item,
  userId,
}: ModerationBulkApproveEligibilityInput) => {
  if (!userId || !item.submission || !item.grade) return false;

  return (
    item.moderationCase.lecturer_id === userId &&
    item.moderationCase.status === "moderated" &&
    item.submission.status === "moderated"
  );
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

  const nextCasePatch: Partial<TablesUpdate<"moderation_cases">> = {};
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
