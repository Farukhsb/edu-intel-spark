import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { dispatchCommunicationMessage } from "@/lib/communications";

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
  resolvedRate: number;
  followUpScheduledCount: number;
  respondedCount: number;
  attendedCount: number;
  escalatedCount: number;
};

export type AdminInterventionEvidenceOutcomeBreakdown = {
  outcome: string;
  count: number;
};

const PROFILE_FIELDS = "id, full_name, email, cohort_id";
const INTERVENTION_FIELDS =
  "id, lecturer_id, student_id, student_name, student_email, intervention_type, status, title, notes, follow_up_date, created_at, updated_at";
const EVENT_FIELDS =
  "id, intervention_id, student_id, lecturer_id, contact_target_type, contact_target_name, contact_method, contacted_at, outcome, summary, next_step, created_at, updated_at";

const OVERDUE_REMINDER_CATEGORY = "intervention-overdue-reminder" as const;

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

const toEvidenceEndOfDayTime = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime() + 24 * 60 * 60 * 1000 - 1;
};

const buildInterventionEvidenceContext = (
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

  const startTime = options.startDate ? new Date(options.startDate).getTime() : null;
  const endTime = toEvidenceEndOfDayTime(options.endDate);

  const rows = dataset.events
    .filter((event) => {
      const contactedAt = new Date(event.contacted_at).getTime();
      if (startTime != null && contactedAt < startTime) return false;
      if (endTime != null && contactedAt > endTime) return false;
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
  const outcomeBreakdown = rows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.outcome] = (accumulator[row.outcome] || 0) + 1;
    return accumulator;
  }, {});
  const resolvedCount = new Set(rows.filter((row) => row.outcome === "resolved").map((row) => row.interventionId)).size;
  const followUpScheduledCount = rows.filter((row) => row.outcome === "follow_up_scheduled").length;
  const respondedCount = rows.filter((row) => row.outcome === "responded").length;
  const attendedCount = rows.filter((row) => row.outcome === "attended").length;
  const escalatedCount = rows.filter((row) => row.outcome === "escalated").length;
  const openCount = relevantInterventions.filter((row) => row.status === "planned" || row.status === "in_progress").length;
  const overdueCount = relevantInterventions.filter((row) => {
    if (!row.follow_up_date) return false;
    return new Date(row.follow_up_date).getTime() < Date.now() && (row.status === "planned" || row.status === "in_progress");
  }).length;

  const summary: AdminInterventionEvidenceSummary = {
    interventionCount: filteredInterventionIds.size,
    eventCount: rows.length,
    uniqueStudents: new Set(rows.map((row) => row.studentLabel)).size,
    uniqueLecturers: new Set(rows.map((row) => row.lecturerLabel)).size,
    resolvedCount,
    openCount,
    overdueCount,
    resolvedRate: filteredInterventionIds.size > 0 ? resolvedCount / filteredInterventionIds.size : 0,
    followUpScheduledCount,
    respondedCount,
    attendedCount,
    escalatedCount,
  };

  return {
    dataset,
    options,
    rows,
    filteredInterventionIds,
    relevantInterventions,
    outcomeBreakdown: Object.entries(outcomeBreakdown)
      .map(([outcome, count]) => ({ outcome, count }))
      .sort((left, right) => right.count - left.count || left.outcome.localeCompare(right.outcome)),
    summary,
    profileById,
    lecturerById,
    interventionById,
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
  const context = buildInterventionEvidenceContext(dataset, options);
  const { rows, summary } = context;

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

const markdownEscape = (value: string | number | null | undefined) =>
  String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

const formatRate = (value: number) => `${Math.round(value * 100)}%`;

export const buildInterventionEvidencePack = (
  dataset: AdminInterventionEvidenceDataset,
  options: {
    cohortId: string | "all";
    startDate: string | null;
    endDate: string | null;
  },
) => {
  const context = buildInterventionEvidenceContext(dataset, options);
  const { rows, summary, outcomeBreakdown } = context;
  const dateLabel = `${options.startDate || "start"} to ${options.endDate || "end"}`;
  const headline = options.cohortId === "all" ? "All cohorts" : `Cohort ${options.cohortId}`;
  const sampleRows = rows.slice(0, 20);

  const lines = [
    `# Intervention evidence pack`,
    ``,
    `Scope: ${headline}`,
    `Date window: ${options.startDate || "not set"} to ${options.endDate || "not set"}`,
    `Generated from filtered evidence rows: ${rows.length}`,
    ``,
    `## Summary`,
    `- Interventions: ${summary.interventionCount}`,
    `- Evidence events: ${summary.eventCount}`,
    `- Students reached: ${summary.uniqueStudents}`,
    `- Lecturers involved: ${summary.uniqueLecturers}`,
    `- Open follow-ups: ${summary.openCount}`,
    `- Overdue follow-ups: ${summary.overdueCount}`,
    `- Resolved interventions: ${summary.resolvedCount}`,
    `- Resolution rate: ${formatRate(summary.resolvedRate)}`,
    `- Follow-up scheduled outcomes: ${summary.followUpScheduledCount}`,
    `- Responded outcomes: ${summary.respondedCount}`,
    `- Attended outcomes: ${summary.attendedCount}`,
    `- Escalated outcomes: ${summary.escalatedCount}`,
    ``,
    `## Outcome breakdown`,
    ...((outcomeBreakdown.length > 0
      ? outcomeBreakdown.map((item) => `- ${item.outcome}: ${item.count}`)
      : ["- No outcomes recorded"])),
    ``,
    `## Evidence rows`,
    sampleRows.length > 0
      ? [
          `| Contacted | Cohort | Student | Lecturer | Contact | Outcome | Summary | Next step |`,
          `| --- | --- | --- | --- | --- | --- | --- | --- |`,
          ...sampleRows.map(
            (row) =>
              `| ${markdownEscape(safeDateLabel(row.contactedAt))} | ${markdownEscape(row.cohortLabel)} | ${markdownEscape(row.studentLabel)} | ${markdownEscape(row.lecturerLabel)} | ${markdownEscape(`${row.contactTargetType} via ${row.contactMethod}`)} | ${markdownEscape(row.outcome)} | ${markdownEscape(row.summary)} | ${markdownEscape(row.nextStep || "-")} |`,
          ),
        ]
      : [`- No evidence rows match the selected filters.`],
    ``,
    `Generated for APP/OfS evidence review. Use alongside the CSV export for audit queries.`,
  ];

  return {
    markdown: lines.join("\n"),
    filename: `app_intervention_evidence_pack_${dateLabel.replace(/\s+/g, "_")}.md`,
    summary,
    rows,
  };
};

const safeDateLabel = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
};

export const queueOverdueInterventionReminders = async (
  dataset: AdminInterventionEvidenceDataset,
  options: {
    cohortId: string | "all";
    startDate: string | null;
    endDate: string | null;
  },
) => {
  const context = buildInterventionEvidenceContext(dataset, options);
  const { profileById, lecturerById } = context;
  const reminderTargets = dataset.interventions
    .filter((row) => {
      if (options.cohortId === "all") return true;
      const studentProfile = row.student_id ? profileById.get(row.student_id) : null;
      return (studentProfile?.cohort_id ?? null) === options.cohortId;
    })
    .filter((row) => row.status === "planned" || row.status === "in_progress")
    .filter((row) => (row.follow_up_date ? new Date(row.follow_up_date).getTime() < Date.now() : false));

  let created = 0;
  let duplicate = 0;
  let failed = 0;

  for (const intervention of reminderTargets) {
    const studentProfile = intervention.student_id ? profileById.get(intervention.student_id) ?? null : null;
    const lecturerProfile = intervention.lecturer_id ? profileById.get(intervention.lecturer_id) ?? null : null;
    const recipientName = lecturerProfile?.full_name || lecturerProfile?.email || lecturerById.get(intervention.lecturer_id) || "Lecturer";
    const subject = `Overdue intervention follow-up for ${intervention.student_name || studentProfile?.full_name || "student"}`;
    const nextStep = intervention.notes?.trim() || "Review the latest support record and confirm the next follow-up action.";
    const result = await dispatchCommunicationMessage({
      category: OVERDUE_REMINDER_CATEGORY,
      recipientName,
      recipientEmail: lecturerProfile?.email ?? null,
      recipientId: lecturerProfile?.id ?? intervention.lecturer_id ?? undefined,
      subject,
      body: `Dear ${recipientName},

This is a reminder that the intervention recorded for ${intervention.student_name || studentProfile?.full_name || studentProfile?.email || "a student"} has an overdue follow-up date.

Intervention:
${intervention.title}

Current status:
${intervention.status}

Due date:
${intervention.follow_up_date ? safeDateLabel(intervention.follow_up_date) : "Not set"}

Evidence note:
${intervention.notes || "No note recorded"}

Next step:
${nextStep}

Please review the support record, update the outcome, or reschedule the follow-up if the student still needs support.`,
      relatedStudentId: intervention.student_id ?? undefined,
    });

    if (result.status === "created") {
      created += 1;
    } else if (result.status === "duplicate") {
      duplicate += 1;
    } else {
      failed += 1;
    }
  }

  return {
    total: reminderTargets.length,
    created,
    duplicate,
    failed,
  };
};
