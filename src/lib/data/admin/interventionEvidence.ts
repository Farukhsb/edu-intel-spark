import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AdminInterventionEvidenceProfileRow = Pick<Tables<"profiles">, "id" | "full_name" | "email" | "cohort_id">;
export type AdminInterventionEvidenceInterventionRow = Pick<
  Tables<"student_interventions">,
  | "id"
  | "lecturer_id"
  | "student_id"
  | "student_name"
  | "student_email"
  | "intervention_type"
  | "status"
  | "title"
  | "notes"
  | "follow_up_date"
  | "created_at"
  | "updated_at"
>;
export type AdminInterventionEvidenceEventRow = Pick<
  Tables<"student_intervention_events">,
  | "id"
  | "intervention_id"
  | "student_id"
  | "lecturer_id"
  | "contact_target_type"
  | "contact_target_name"
  | "contact_method"
  | "contacted_at"
  | "outcome"
  | "summary"
  | "next_step"
  | "created_at"
  | "updated_at"
>;

export type AdminInterventionEvidenceDataset = {
  profiles: AdminInterventionEvidenceProfileRow[];
  interventions: AdminInterventionEvidenceInterventionRow[];
  events: AdminInterventionEvidenceEventRow[];
};

export type AdminInterventionEvidenceRow = {
  id: string;
  interventionId: string;
  contactedAt: string;
  cohortLabel: string;
  studentLabel: string;
  studentEmail: string;
  lecturerLabel: string;
  interventionTitle: string;
  interventionStatus: string;
  interventionType: string;
  contactTargetType: string;
  contactTargetName: string;
  contactMethod: string;
  outcome: string;
  summary: string;
  nextStep: string;
  followUpDate: string | null;
  interventionCreatedAt: string;
  eventCreatedAt: string;
};

export type AdminInterventionEvidenceSummary = {
  interventionCount: number;
  eventCount: number;
  uniqueStudents: number;
  uniqueLecturers: number;
  resolvedCount: number;
  openCount: number;
  overdueCount: number;
};

const PROFILE_FIELDS = "id, full_name, email, cohort_id";
const INTERVENTION_FIELDS =
  "id, lecturer_id, student_id, student_name, student_email, intervention_type, status, title, notes, follow_up_date, created_at, updated_at";
const EVENT_FIELDS =
  "id, intervention_id, student_id, lecturer_id, contact_target_type, contact_target_name, contact_method, contacted_at, outcome, summary, next_step, created_at, updated_at";

export const fetchAdminInterventionEvidenceDataset = async (): Promise<AdminInterventionEvidenceDataset> => {
  const [profilesRes, interventionsRes, eventsRes] = await Promise.all([
    supabase.from("profiles").select(PROFILE_FIELDS),
    supabase.from("student_interventions").select(INTERVENTION_FIELDS).order("created_at", { ascending: false }),
    supabase.from("student_intervention_events").select(EVENT_FIELDS).order("contacted_at", { ascending: false }),
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (interventionsRes.error) throw interventionsRes.error;
  if (eventsRes.error) throw eventsRes.error;

  return {
    profiles: (profilesRes.data || []) as AdminInterventionEvidenceProfileRow[],
    interventions: (interventionsRes.data || []) as AdminInterventionEvidenceInterventionRow[],
    events: (eventsRes.data || []) as AdminInterventionEvidenceEventRow[],
  };
};

const toTitleCase = (value: string) =>
  value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const csvEscape = (value: string | number | null | undefined) => {
  const text = value == null ? "" : String(value);
  return `"${text.split('"').join('""')}"`;
};

export const buildInterventionEvidenceReport = (
  dataset: AdminInterventionEvidenceDataset,
  options: {
    cohortId: string | "all";
    startDate: string | null;
    endDate: string | null;
  },
) => {
  const profileById = new Map(dataset.profiles.map((profile) => [profile.id, profile]));
  const lecturerById = new Map(
    dataset.profiles.map((profile) => [profile.id, profile.full_name || profile.email || "Unknown lecturer"]),
  );
  const interventionById = new Map(dataset.interventions.map((row) => [row.id, row]));

  const rows = dataset.events
    .filter((event) => {
      const contactedAt = new Date(event.contacted_at).getTime();
      const startTime = options.startDate ? new Date(options.startDate).getTime() : null;
      const endTime = options.endDate ? new Date(options.endDate).getTime() : null;
      if (startTime != null && contactedAt < startTime) return false;
      if (endTime != null && contactedAt > endTime + 24 * 60 * 60 * 1000 - 1) return false;
      if (options.cohortId !== "all") {
        const intervention = interventionById.get(event.intervention_id);
        const profile = intervention?.student_id ? profileById.get(intervention.student_id) : null;
        if ((profile?.cohort_id ?? null) !== options.cohortId) return false;
      }
      return true;
    })
    .map<AdminInterventionEvidenceRow>((event) => {
      const intervention = interventionById.get(event.intervention_id);
      const studentProfile = event.student_id ? profileById.get(event.student_id) : null;

      return {
        id: event.id,
        interventionId: event.intervention_id,
        contactedAt: event.contacted_at,
        cohortLabel: studentProfile?.cohort_id || "No cohort recorded",
        studentLabel:
          intervention?.student_name ||
          studentProfile?.full_name ||
          studentProfile?.email ||
          "Unknown student",
        studentEmail: intervention?.student_email || studentProfile?.email || "",
        lecturerLabel: lecturerById.get(event.lecturer_id) || "Unknown lecturer",
        interventionTitle: intervention?.title || toTitleCase(intervention?.intervention_type || "intervention"),
        interventionStatus: intervention?.status || "unknown",
        interventionType: intervention?.intervention_type || "unknown",
        contactTargetType: event.contact_target_type,
        contactTargetName: event.contact_target_name,
        contactMethod: event.contact_method,
        outcome: event.outcome,
        summary: event.summary,
        nextStep: event.next_step || "",
        followUpDate: intervention?.follow_up_date || null,
        interventionCreatedAt: intervention?.created_at || event.created_at,
        eventCreatedAt: event.created_at,
      };
    });

  const filteredInterventionIds = new Set(rows.map((row) => row.interventionId));
  const relevantInterventions = dataset.interventions.filter((row) => filteredInterventionIds.has(row.id));
  const uniqueStudentLabels = new Set(rows.map((row) => row.studentLabel));
  const uniqueLecturers = new Set(rows.map((row) => row.lecturerLabel));
  const resolvedCount = rows.filter((row) => row.outcome === "resolved").length;
  const openCount = relevantInterventions.filter((row) => row.status === "planned" || row.status === "in_progress").length;
  const overdueCount = relevantInterventions.filter((row) => {
    if (!row.follow_up_date) return false;
    return new Date(row.follow_up_date).getTime() < Date.now() && (row.status === "planned" || row.status === "in_progress");
  }).length;

  const summary: AdminInterventionEvidenceSummary = {
    interventionCount: filteredInterventionIds.size,
    eventCount: rows.length,
    uniqueStudents: uniqueStudentLabels.size,
    uniqueLecturers: uniqueLecturers.size,
    resolvedCount,
    openCount,
    overdueCount,
  };

  const csv = [
    [
      "Contacted At",
      "Cohort",
      "Student",
      "Student Email",
      "Lecturer",
      "Intervention",
      "Intervention Status",
      "Intervention Type",
      "Who Was Contacted",
      "Contact Name",
      "Contact Method",
      "Outcome",
      "Summary",
      "Next Step",
      "Follow-up Date",
    ]
      .map(csvEscape)
      .join(","),
    ...rows.map((row) =>
      [
        row.contactedAt,
        row.cohortLabel,
        row.studentLabel,
        row.studentEmail,
        row.lecturerLabel,
        row.interventionTitle,
        row.interventionStatus,
        row.interventionType,
        row.contactTargetType,
        row.contactTargetName,
        row.contactMethod,
        row.outcome,
        row.summary,
        row.nextStep,
        row.followUpDate || "",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n");

  return {
    rows,
    summary,
    csv,
  };
};
