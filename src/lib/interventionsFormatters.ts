import type {
  InterventionContactMethod,
  InterventionContactTargetType,
  InterventionEventEntry,
  InterventionEntry,
  InterventionOutcome,
  ManualInterventionStatus,
  ManualInterventionType,
  StudentInterventionEventRow,
  StudentInterventionRow,
} from "@/lib/interventionsTypes";

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

export const toStoredInterventionTypeForTesting = toStoredInterventionType;
