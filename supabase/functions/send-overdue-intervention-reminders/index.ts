import { z } from "https://esm.sh/zod@3.23.8";

import { createAdminClient, HttpError, jsonError } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { requirePostMethod } from "../_shared/http.ts";
import { logInfo, logWarn } from "../_shared/log.ts";

const ReminderRequestSchema = z.object({
  mode: z.enum(["weekly"]).optional(),
});

const SETTINGS_TABLE = "intervention_follow_up_settings";
const SETTINGS_ROW_ID = 1;
const SCHEDULER_HEADER = "x-overdue-intervention-reminders-scheduler";
const SCHEDULER_VALUE = "weekly";
const REMINDER_CATEGORY = "intervention-overdue-reminder";
const DEDUPE_WINDOW_DAYS = 6;

type InterventionRow = {
  id: string;
  institution_id: string;
  lecturer_id: string;
  student_id: string;
  student_name: string | null;
  student_email: string | null;
  status: string;
  title: string;
  notes: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  institution_id: string | null;
  full_name: string | null;
  email: string | null;
};

type CommunicationMessageRow = {
  id: string;
};

type OverdueReminderResult = {
  institutionId: string;
  overdueCount: number;
  createdCount: number;
  duplicateCount: number;
  failedCount: number;
};

const normalizeEmail = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

const jsonSuccess = (corsHeaders: Record<string, string>, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function getSchedulerSecret(supabaseAdmin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabaseAdmin
    .from(SETTINGS_TABLE)
    .select("scheduler_secret, enabled")
    .eq("id", SETTINGS_ROW_ID)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!data?.scheduler_secret) {
    throw new HttpError(500, "Intervention reminder scheduler secret is not configured");
  }

  if (data.enabled === false) {
    throw new HttpError(403, "Scheduled intervention reminders are disabled");
  }

  return data.scheduler_secret as string;
}

function isSchedulerRequest(req: Request, schedulerSecret: string) {
  return req.headers.get("apikey") === schedulerSecret && req.headers.get(SCHEDULER_HEADER) === SCHEDULER_VALUE;
}

async function fetchActiveInstitutions(supabaseAdmin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabaseAdmin
    .from("institutions")
    .select("id")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    throw new HttpError(500, error.message);
  }

  return (data ?? []).map((row) => row.id as string);
}

async function fetchOverdueInterventions(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  institutionId: string,
) {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("student_interventions")
    .select("id, institution_id, lecturer_id, student_id, student_name, student_email, status, title, notes, follow_up_date, created_at, updated_at")
    .eq("institution_id", institutionId)
    .in("status", ["planned", "in_progress"])
    .not("follow_up_date", "is", null)
    .lt("follow_up_date", nowIso)
    .order("follow_up_date", { ascending: true });

  if (error) {
    throw new HttpError(500, error.message);
  }

  return (data ?? []) as InterventionRow[];
}

async function fetchProfilesByIds(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  institutionId: string,
  profileIds: string[],
) {
  if (profileIds.length === 0) {
    return [] as ProfileRow[];
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, institution_id, full_name, email")
    .eq("institution_id", institutionId)
    .in("id", profileIds);

  if (error) {
    throw new HttpError(500, error.message);
  }

  return (data ?? []) as ProfileRow[];
}

async function hasRecentReminder(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  input: {
    institutionId: string;
    lecturerId: string;
    studentId: string;
    subject: string;
  },
) {
  const dedupeWindowStart = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("communication_messages")
    .select("id")
    .eq("institution_id", input.institutionId)
    .eq("category", REMINDER_CATEGORY)
    .eq("recipient_id", input.lecturerId)
    .eq("related_student_id", input.studentId)
    .eq("subject", input.subject)
    .gte("created_at", dedupeWindowStart)
    .limit(1)
    .maybeSingle<CommunicationMessageRow>();

  if (error && error.code !== "PGRST116") {
    throw new HttpError(500, error.message);
  }

  return Boolean(data?.id);
}

async function createReminderMessage(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  input: {
    institutionId: string;
    lecturerId: string;
    lecturerName: string;
    lecturerEmail: string | null;
    studentName: string;
    studentEmail: string | null;
    studentId: string;
    intervention: InterventionRow;
  },
) {
  const subject = `Overdue intervention follow-up for ${input.studentName}`;
  const alreadySent = await hasRecentReminder(supabaseAdmin, {
    institutionId: input.institutionId,
    lecturerId: input.lecturerId,
    studentId: input.studentId,
    subject,
  });

  if (alreadySent) {
    return { status: "duplicate" as const };
  }

  const nextStep = input.intervention.notes?.trim() || "Review the latest support record and confirm the next follow-up action.";
  const body = `Dear ${input.lecturerName},

This is a reminder that the intervention recorded for ${input.studentName} has an overdue follow-up date.

Intervention:
${input.intervention.title}

Current status:
${input.intervention.status}

Due date:
${input.intervention.follow_up_date || "Not set"}

Evidence note:
${input.intervention.notes || "No note recorded"}

Next step:
${nextStep}

Please review the support record, update the outcome, or reschedule the follow-up if the student still needs support.`;

  const { error } = await supabaseAdmin.from("communication_messages").insert({
    sender_id: input.lecturerId,
    institution_id: input.institutionId,
    recipient_id: input.lecturerId,
    recipient_name: input.lecturerName,
    recipient_email: input.lecturerEmail,
    category: REMINDER_CATEGORY,
    subject,
    body,
    related_student_id: input.studentId,
    related_assignment_id: null,
  });

  if (error) {
    throw new HttpError(500, error.message);
  }

  return { status: "created" as const };
}

async function processInstitution(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  institutionId: string,
): Promise<OverdueReminderResult> {
  const overdueInterventions = await fetchOverdueInterventions(supabaseAdmin, institutionId);
  const lecturerIds = [...new Set(overdueInterventions.map((row) => row.lecturer_id).filter(Boolean))];
  const studentIds = [...new Set(overdueInterventions.map((row) => row.student_id).filter(Boolean))];
  const profiles = await fetchProfilesByIds(supabaseAdmin, institutionId, [...lecturerIds, ...studentIds]);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  let createdCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;

  for (const intervention of overdueInterventions) {
    const lecturerProfile = profileById.get(intervention.lecturer_id) || null;
    const studentProfile = profileById.get(intervention.student_id) || null;
    const lecturerName = lecturerProfile?.full_name || lecturerProfile?.email || "Lecturer";
    const studentName =
      intervention.student_name ||
      studentProfile?.full_name ||
      studentProfile?.email ||
      "student";

    try {
      const result = await createReminderMessage(supabaseAdmin, {
        institutionId,
        lecturerId: intervention.lecturer_id,
        lecturerName,
        lecturerEmail: lecturerProfile?.email ?? null,
        studentName,
        studentEmail: studentProfile?.email ?? intervention.student_email ?? null,
        studentId: intervention.student_id,
        intervention,
      });

      if (result.status === "created") {
        createdCount += 1;
      } else {
        duplicateCount += 1;
      }
    } catch (error) {
      failedCount += 1;
      logWarn("Failed to create overdue intervention reminder", {
        function: "send-overdue-intervention-reminders",
        institutionId,
        interventionId: intervention.id,
        error: error instanceof Error ? error.message : "Unknown reminder failure",
      });
    }
  }

  return {
    institutionId,
    overdueCount: overdueInterventions.length,
    createdCount,
    duplicateCount,
    failedCount,
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) return createCorsForbiddenResponse();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const methodError = requirePostMethod(req, corsHeaders);
  if (methodError) return methodError;

  try {
    const supabaseAdmin = createAdminClient();
    const schedulerSecret = await getSchedulerSecret(supabaseAdmin);

    if (!isSchedulerRequest(req, schedulerSecret)) {
      throw new HttpError(403, "Scheduler token required");
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = ReminderRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      throw new HttpError(400, "Invalid request format");
    }

    const institutionIds = await fetchActiveInstitutions(supabaseAdmin);
    const results: OverdueReminderResult[] = [];

    for (const institutionId of institutionIds) {
      results.push(await processInstitution(supabaseAdmin, institutionId));
    }

    const totals = results.reduce(
      (accumulator, item) => ({
        overdueCount: accumulator.overdueCount + item.overdueCount,
        createdCount: accumulator.createdCount + item.createdCount,
        duplicateCount: accumulator.duplicateCount + item.duplicateCount,
        failedCount: accumulator.failedCount + item.failedCount,
      }),
      { overdueCount: 0, createdCount: 0, duplicateCount: 0, failedCount: 0 },
    );

    logInfo("send-overdue-intervention-reminders completed", {
      function: "send-overdue-intervention-reminders",
      institutionCount: institutionIds.length,
      ...totals,
    });

    return jsonSuccess(corsHeaders, {
      data: {
        mode: parsed.data.mode ?? "weekly",
        institutionCount: institutionIds.length,
        results,
        ...totals,
      },
    });
  } catch (error) {
    return jsonError(error, corsHeaders);
  }
});
