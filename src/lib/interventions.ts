import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables, TablesInsert } from "@/integrations/supabase/types";

export type ManualInterventionType = "email" | "meeting" | "feedback" | "referral";
export type ManualInterventionStatus = "ongoing" | "resolved";

export interface InterventionEntry {
  id: string;
  createdAt: string;
  type: string;
  note: string;
  followUpDate: string | null;
  status: string;
}

export interface StudentInterventionReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

export type StudentInterventionRow = Tables<"student_interventions">;

export interface RecommendationInterventionTarget {
  studentId: string;
  name: string;
  email: string | null;
}

export interface ManualInterventionPayloadInput {
  lecturerId: string;
  studentId: string;
  studentName: string;
  studentEmail: string | null;
  interventionType: ManualInterventionType;
  interventionStatus: ManualInterventionStatus;
  note: string;
  followUpDate: string | null;
  riskLevel?: string | null;
}

const toStoredInterventionType = (value: ManualInterventionType): string =>
  value === "referral" ? "support_referral" : value;

const toDisplayInterventionType = (value: string | null | undefined) => {
  if (!value) return "other";
  if (value === "support_referral") return "referral";
  return value;
};

export const normalizeManualInterventionType = (value: string): ManualInterventionType => {
  if (value === "email" || value === "meeting" || value === "feedback" || value === "referral") {
    return value;
  }

  return "email";
};

export const normalizeManualInterventionStatus = (value: string): ManualInterventionStatus => {
  if (value === "ongoing" || value === "resolved") {
    return value;
  }

  return "ongoing";
};

export const getInterventionErrorText = (error: { message?: string; details?: string; hint?: string } | null) =>
  [error?.message, error?.details, error?.hint].filter(Boolean).join(" | ");

export const mapInterventionRow = (row: StudentInterventionRow): InterventionEntry => ({
  id: row.id,
  createdAt: row.created_at || row.updated_at || new Date().toISOString(),
  type: toDisplayInterventionType(row.intervention_type),
  note: row.notes || "",
  followUpDate: row.follow_up_date || null,
  status: row.status,
});

export const buildManualInterventionPayload = ({
  lecturerId,
  studentId,
  studentName,
  studentEmail,
  interventionType,
  interventionStatus,
  note,
  followUpDate,
  riskLevel,
}: ManualInterventionPayloadInput): TablesInsert<"student_interventions"> => {
  const safeType = normalizeManualInterventionType(interventionType);
  const safeStatus = normalizeManualInterventionStatus(interventionStatus);
  const storedType = toStoredInterventionType(safeType);

  return {
    lecturer_id: lecturerId,
    student_id: studentId,
    student_name: studentName,
    student_email: studentEmail,
    intervention_type: storedType,
    title: `${safeType.charAt(0).toUpperCase()}${safeType.slice(1)} intervention`,
    notes: note.trim(),
    priority: riskLevel === "critical" || riskLevel === "high" ? "high" : "medium",
    follow_up_date: followUpDate || null,
    status: safeStatus,
    assignment_id: null,
    updated_at: new Date().toISOString(),
  };
};

export const buildRecommendationInterventionRows = ({
  lecturerId,
  title,
  summary,
  recommendedActions,
  severity,
  assignmentId,
  targets,
}: {
  lecturerId: string;
  title: string;
  summary: string;
  recommendedActions: string[];
  severity: string;
  assignmentId: string | null;
  targets: RecommendationInterventionTarget[];
}): TablesInsert<"student_interventions">[] =>
  targets.slice(0, 5).map((target) => ({
    lecturer_id: lecturerId,
    student_id: target.studentId,
    student_name: target.name,
    student_email: target.email,
    intervention_type: "check_in",
    title,
    notes: `${summary}\n\nRecommended actions:\n- ${recommendedActions.join("\n- ")}`,
    priority: severity === "critical" || severity === "high" ? "high" : "medium",
    follow_up_date: new Date(Date.now() + 7 * 86400000).toISOString(),
    status: "ongoing",
    assignment_id: assignmentId,
    updated_at: new Date().toISOString(),
  }));

export async function fetchStudentInterventions(
  supabase: SupabaseClient<Database>,
  lecturerId: string,
  studentId: string
) {
  const { data, error } = await supabase
    .from("student_interventions")
    .select("id, lecturer_id, student_id, student_name, student_email, intervention_type, status, priority, title, notes, follow_up_date, assignment_id, created_at, updated_at")
    .eq("lecturer_id", lecturerId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error };
  }

  return {
    data: ((data || []) as StudentInterventionRow[]).map(mapInterventionRow),
    error: null,
  };
}

export async function insertManualIntervention(
  supabase: SupabaseClient<Database>,
  payload: TablesInsert<"student_interventions">
) {
  const { data, error } = await supabase
    .from("student_interventions")
    .insert(payload)
    .select("id, lecturer_id, student_id, student_name, student_email, intervention_type, status, priority, title, notes, follow_up_date, assignment_id, created_at, updated_at")
    .single();

  if (error) {
    return { data: null, error };
  }

  return {
    data: mapInterventionRow(data as StudentInterventionRow),
    error: null,
  };
}

export async function insertRecommendationInterventions(
  supabase: SupabaseClient<Database>,
  rows: TablesInsert<"student_interventions">[]
) {
  if (rows.length === 0) {
    return { error: null };
  }

  const { error } = await supabase.from("student_interventions").insert(rows);
  return { error };
}

export const getStudentInterventionReadiness = ({
  riskLevel,
  recommendation,
  missedAssignmentsCount,
  openInterventions,
  latestIntervention,
}: {
  riskLevel: string | null | undefined;
  recommendation: string;
  missedAssignmentsCount: number;
  openInterventions: number;
  latestIntervention: InterventionEntry | null;
}): StudentInterventionReadiness => {
  const urgentRisk = riskLevel === "critical" || riskLevel === "high";
  const pendingFollowUp = latestIntervention?.status === "ongoing";

  return {
    postureLabel:
      urgentRisk && openInterventions === 0
        ? "Immediate intervention position"
        : pendingFollowUp || missedAssignmentsCount > 0
          ? "Active follow-up position"
          : "Stabilisation position",
    likelyChallenge:
      missedAssignmentsCount > 0
        ? `${missedAssignmentsCount} missed assignment${missedAssignmentsCount === 1 ? "" : "s"} still unresolved`
        : latestIntervention?.note || recommendation,
    bestNextAction:
      openInterventions === 0
        ? "Log the first intervention and send a student support alert"
        : pendingFollowUp
          ? "Review the latest intervention and confirm follow-up progress"
          : "Close resolved actions or schedule the next support check-in",
  };
};
