import type {
  ManualInterventionPayloadInput,
  RecommendationInterventionTarget,
  StudentInterventionEventPayloadInput,
  StudentInterventionInsert,
  StudentInterventionEventInsert,
} from "@/lib/interventionsTypes";
import {
  normalizeManualInterventionStatus,
  normalizeManualInterventionType,
  toStoredInterventionTypeForTesting,
} from "@/lib/interventionsFormatters";

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
}: ManualInterventionPayloadInput): StudentInterventionInsert => {
  const safeType = normalizeManualInterventionType(interventionType);
  const safeStatus = normalizeManualInterventionStatus(interventionStatus);
  const storedType = toStoredInterventionTypeForTesting(safeType);

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
}: StudentInterventionEventPayloadInput): StudentInterventionEventInsert => ({
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
}): StudentInterventionInsert[] =>
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
