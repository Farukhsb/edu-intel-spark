import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables, TablesInsert } from "@/integrations/supabase/types";

export type ManualInterventionType = "email" | "meeting" | "feedback" | "referral";
export type ManualInterventionStatus = "planned" | "in_progress" | "completed" | "resolved";
export type InterventionContactTargetType =
  | "student"
  | "parent"
  | "guardian"
  | "tutor"
  | "course_leader"
  | "department_head"
  | "support_service"
  | "placement_supervisor"
  | "employer"
  | "other";
export type InterventionContactMethod = "email" | "meeting" | "phone" | "lms_message" | "sms" | "in_person" | "referral" | "other";
export type InterventionOutcome =
  | "no_response"
  | "left_message"
  | "responded"
  | "attended"
  | "referred"
  | "resolved"
  | "follow_up_scheduled"
  | "escalated"
  | "ongoing"
  | "other";

export interface InterventionEntry {
  id: string;
  createdAt: string;
  title: string;
  type: string;
  note: string;
  followUpDate: string | null;
  status: ManualInterventionStatus;
}

export interface InterventionEventEntry {
  id: string;
  interventionId: string;
  studentId: string;
  lecturerId: string;
  contactedAt: string;
  contactTargetType: InterventionContactTargetType;
  contactTargetName: string;
  contactMethod: InterventionContactMethod;
  outcome: InterventionOutcome;
  summary: string;
  nextStep: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentInterventionReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

export type StudentInterventionRow = Tables<"student_interventions">;
export type StudentInterventionEventRow = Tables<"student_intervention_events">;

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

export interface StudentInterventionEventPayloadInput {
  lecturerId: string;
  studentId: string;
  interventionId: string;
  contactTargetType: InterventionContactTargetType;
  contactTargetName: string;
  contactMethod: InterventionContactMethod;
  outcome: InterventionOutcome;
  summary: string;
  nextStep?: string | null;
  contactedAt?: string;
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
  if (value === "ongoing") {
    return "in_progress";
  }

  if (value === "planned" || value === "in_progress" || value === "completed" || value === "resolved") {
    return value;
  }

  return "planned";
};

export const normalizeInterventionContactTargetType = (value: string): InterventionContactTargetType => {
  if (
    value === "student" ||
    value === "parent" ||
    value === "guardian" ||
    value === "tutor" ||
    value === "course_leader" ||
    value === "department_head" ||
    value === "support_service" ||
    value === "placement_supervisor" ||
    value === "employer"
  ) {
    return value;
  }

  return "other";
};

export const normalizeInterventionContactMethod = (value: string): InterventionContactMethod => {
  if (
    value === "email" ||
    value === "meeting" ||
    value === "phone" ||
    value === "lms_message" ||
    value === "sms" ||
    value === "in_person" ||
    value === "referral"
  ) {
    return value;
  }

  return "other";
};

export const normalizeInterventionOutcome = (value: string): InterventionOutcome => {
  if (
    value === "no_response" ||
    value === "left_message" ||
    value === "responded" ||
    value === "attended" ||
    value === "referred" ||
    value === "resolved" ||
    value === "follow_up_scheduled" ||
    value === "escalated" ||
    value === "ongoing"
  ) {
    return value;
  }

  return "other";
};

export const formatManualInterventionStatus = (value: ManualInterventionStatus) => {
  switch (value) {
    case "planned":
      return "Planned";
    case "in_progress":
      return "Ongoing";
    case "completed":
      return "Completed";
    case "resolved":
      return "Resolved";
    default:
      return value;
  }
};

const toTitleCase = (value: string) =>
  value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const formatInterventionContactTargetType = (value: InterventionContactTargetType) => {
  switch (value) {
    case "course_leader":
      return "Course leader";
    case "department_head":
      return "Department head";
    case "support_service":
      return "Support service";
    case "placement_supervisor":
      return "Placement supervisor";
    default:
      return toTitleCase(value);
  }
};

export const formatInterventionContactMethod = (value: InterventionContactMethod) => {
  switch (value) {
    case "lms_message":
      return "LMS message";
    case "in_person":
      return "In person";
    default:
      return toTitleCase(value);
  }
};

export const formatInterventionOutcome = (value: InterventionOutcome) => {
  switch (value) {
    case "no_response":
      return "No response";
    case "left_message":
      return "Left message";
    case "follow_up_scheduled":
      return "Follow-up scheduled";
    case "ongoing":
      return "Ongoing";
    default:
      return toTitleCase(value);
  }
};

export const getInterventionErrorText = (error: { message?: string; details?: string; hint?: string } | null) =>
  [error?.message, error?.details, error?.hint].filter(Boolean).join(" | ");

export const mapInterventionRow = (row: StudentInterventionRow): InterventionEntry => ({
  id: row.id,
  createdAt: row.created_at || row.updated_at || new Date().toISOString(),
  title: row.title,
  type: toDisplayInterventionType(row.intervention_type),
  note: row.notes || "",
  followUpDate: row.follow_up_date || null,
  status: normalizeManualInterventionStatus(row.status),
});

export const mapInterventionEventRow = (row: StudentInterventionEventRow): InterventionEventEntry => ({
  id: row.id,
  interventionId: row.intervention_id,
  studentId: row.student_id,
  lecturerId: row.lecturer_id,
  contactedAt: row.contacted_at || row.updated_at || new Date().toISOString(),
  contactTargetType: normalizeInterventionContactTargetType(row.contact_target_type),
  contactTargetName: row.contact_target_name,
  contactMethod: normalizeInterventionContactMethod(row.contact_method),
  outcome: normalizeInterventionOutcome(row.outcome),
  summary: row.summary,
  nextStep: row.next_step || null,
  createdAt: row.created_at || row.updated_at || new Date().toISOString(),
  updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
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

export const buildStudentInterventionEventPayload = ({
  lecturerId,
  studentId,
  interventionId,
  contactTargetType,
  contactTargetName,
  contactMethod,
  outcome,
  summary,
  nextStep,
  contactedAt,
}: StudentInterventionEventPayloadInput): TablesInsert<"student_intervention_events"> => ({
  lecturer_id: lecturerId,
  student_id: studentId,
  intervention_id: interventionId,
  contact_target_type: contactTargetType,
  contact_target_name: contactTargetName.trim(),
  contact_method: contactMethod,
  outcome,
  summary: summary.trim(),
  next_step: nextStep?.trim() || null,
  contacted_at: contactedAt || new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

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
    status: "planned",
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

export async function fetchStudentInterventionEvents(
  supabase: SupabaseClient<Database>,
  lecturerId: string,
  studentId: string
) {
  const { data, error } = await supabase
    .from("student_intervention_events")
    .select("id, intervention_id, student_id, lecturer_id, contact_target_type, contact_target_name, contact_method, contacted_at, outcome, summary, next_step, created_at, updated_at")
    .eq("lecturer_id", lecturerId)
    .eq("student_id", studentId)
    .order("contacted_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error };
  }

  return {
    data: ((data || []) as StudentInterventionEventRow[]).map(mapInterventionEventRow),
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

export async function insertStudentInterventionEvent(
  supabase: SupabaseClient<Database>,
  payload: TablesInsert<"student_intervention_events">
) {
  const { data, error } = await supabase
    .from("student_intervention_events")
    .insert(payload)
    .select("id, intervention_id, student_id, lecturer_id, contact_target_type, contact_target_name, contact_method, contacted_at, outcome, summary, next_step, created_at, updated_at")
    .single();

  if (error) {
    return { data: null, error };
  }

  return {
    data: mapInterventionEventRow(data as StudentInterventionEventRow),
    error: null,
  };
}

export async function updateStudentInterventionStatus(
  supabase: SupabaseClient<Database>,
  interventionId: string,
  status: ManualInterventionStatus,
) {
  const { data, error } = await supabase
    .from("student_interventions")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", interventionId)
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

export const isInterventionOverdue = (
  intervention: Pick<InterventionEntry, "status" | "followUpDate">,
  now = Date.now(),
) => {
  if (!["planned", "in_progress"].includes(intervention.status) || !intervention.followUpDate) {
    return false;
  }

  return new Date(intervention.followUpDate).getTime() < now;
};

export const getStudentInterventionReadiness = ({
  riskLevel,
  recommendation,
  missedAssignmentsCount,
  openInterventions,
  overdueInterventions,
  latestIntervention,
}: {
  riskLevel: string | null | undefined;
  recommendation: string;
  missedAssignmentsCount: number;
  openInterventions: number;
  overdueInterventions: number;
  latestIntervention: InterventionEntry | null;
}): StudentInterventionReadiness => {
  const urgentRisk = riskLevel === "critical" || riskLevel === "high";
  const pendingFollowUp =
    latestIntervention?.status === "planned" || latestIntervention?.status === "in_progress";

  return {
    postureLabel:
      overdueInterventions > 0
        ? "Follow-up overdue position"
        : urgentRisk && openInterventions === 0
        ? "Immediate intervention position"
        : pendingFollowUp || missedAssignmentsCount > 0
          ? "Active follow-up position"
          : "Stabilisation position",
    likelyChallenge:
      overdueInterventions > 0
        ? `${overdueInterventions} intervention follow-up date${overdueInterventions === 1 ? " is" : "s are"} overdue`
        : missedAssignmentsCount > 0
        ? `${missedAssignmentsCount} missed assignment${missedAssignmentsCount === 1 ? "" : "s"} still unresolved`
        : latestIntervention?.note || recommendation,
    bestNextAction:
      overdueInterventions > 0
        ? "Review overdue interventions, confirm progress, and either resolve or reschedule them"
        : openInterventions === 0
        ? "Log the first intervention and send a student support alert"
        : pendingFollowUp
          ? "Review the latest intervention and confirm follow-up progress"
          : "Close resolved actions or schedule the next support check-in",
  };
};
