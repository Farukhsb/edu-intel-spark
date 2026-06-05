import { createAdminClient } from "../../_shared/auth.ts";
import { logError, logInfo, logWarn } from "../../_shared/log.ts";
import { resolveLmsSyncConfig } from "../config.ts";
import { LmsIntegrationError, LmsProviderNotConfiguredError } from "../errors.ts";
import { createBlackboardProvider } from "../providers/blackboard.ts";
import { createCanvasProvider } from "../providers/canvas.ts";
import { createMoodleProvider } from "../providers/moodle.ts";
import { recordLmsAuditEvent } from "../storage/audit-log.ts";
import { upsertLmsSyncCursor } from "../storage/cursors.ts";
import { resolveLmsProviderToken } from "../storage/provider-tokens.ts";
import { createLmsSyncRun, finishLmsSyncRun } from "../storage/sync-run.ts";
import type {
  LmsAssignmentRecord,
  LmsCourseRecord,
  LmsEngagementEvent,
  LmsGradeRecord,
  LmsProviderId,
  LmsSubmissionRecord,
  LmsSyncRequest,
  LmsSyncResponse,
  LmsSyncSummary,
  LmsTimingEvent,
} from "../types.ts";

function emptySummary(): LmsSyncSummary {
  return {
    coursesSynced: 0,
    assignmentsSynced: 0,
    submissionsSynced: 0,
    gradesSynced: 0,
    eventsSynced: 0,
  };
}

async function resolveInstitution(supabaseAdmin: ReturnType<typeof createAdminClient>, request: LmsSyncRequest) {
  if (request.institutionId) {
    const { data, error } = await supabaseAdmin
      .from("institutions")
      .select("id, slug, name")
      .eq("id", request.institutionId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as { id: string; slug: string; name: string };
  }

  if (request.institutionSlug) {
    const { data, error } = await supabaseAdmin
      .from("institutions")
      .select("id, slug, name")
      .eq("slug", request.institutionSlug)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as { id: string; slug: string; name: string };
  }

  const config = resolveLmsSyncConfig();
  if (config.defaultInstitutionId) {
    const { data, error } = await supabaseAdmin
      .from("institutions")
      .select("id, slug, name")
      .eq("id", config.defaultInstitutionId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as { id: string; slug: string; name: string };
  }

  if (config.defaultInstitutionSlug) {
    const { data, error } = await supabaseAdmin
      .from("institutions")
      .select("id, slug, name")
      .eq("slug", config.defaultInstitutionSlug)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as { id: string; slug: string; name: string };
  }

  throw new LmsIntegrationError("No LMS institution was provided for sync.");
}

async function resolveConnection(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  provider: LmsProviderId,
  institutionId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("lms_connections")
    .select("institution_id, provider, base_url, access_token_secret_name, enabled, metadata")
    .eq("institution_id", institutionId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) throw error;
  return data as
    | {
      institution_id: string;
      provider: LmsProviderId;
      base_url: string;
      access_token_secret_name: string | null;
      enabled: boolean;
      metadata: Record<string, unknown> | null;
    }
    | null;
}

type LmsProviderConnection = NonNullable<Awaited<ReturnType<typeof resolveConnection>>>;

function createProviderAdapter(
  provider: LmsProviderId,
  connection: LmsProviderConnection,
  accessToken: string,
) {
  const providerConnection = {
    baseUrl: connection.base_url,
    accessToken,
    metadata: connection.metadata,
  };

  if (provider === "canvas") {
    return createCanvasProvider(providerConnection);
  }

  if (provider === "blackboard") {
    return createBlackboardProvider(providerConnection);
  }

  if (provider === "moodle") {
    return createMoodleProvider(providerConnection);
  }

  throw new LmsProviderNotConfiguredError(provider);
}

async function persistCourse(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  institutionId: string,
  course: LmsCourseRecord,
) {
  const { error } = await supabaseAdmin.from("lms_courses").upsert({
    institution_id: institutionId,
    provider: course.id.provider,
    external_id: course.id.externalId,
    code: course.code,
    title: course.title,
    term: course.term,
    updated_at: course.updatedAt ?? new Date().toISOString(),
    raw: course,
  }, { onConflict: "institution_id,provider,external_id" });

  if (error) throw error;
}

async function persistAssignment(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  institutionId: string,
  assignment: LmsAssignmentRecord,
) {
  const { error } = await supabaseAdmin.from("lms_assignments").upsert({
    institution_id: institutionId,
    provider: assignment.id.provider,
    external_id: assignment.id.externalId,
    course_external_id: assignment.courseId.externalId,
    title: assignment.title,
    due_at: assignment.dueAt,
    available_from: assignment.availableFrom,
    available_until: assignment.availableUntil,
    updated_at: new Date().toISOString(),
    raw: assignment,
  }, { onConflict: "institution_id,provider,external_id" });

  if (error) throw error;
}

async function persistSubmission(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  institutionId: string,
  submission: LmsSubmissionRecord,
) {
  const { error } = await supabaseAdmin.from("lms_submissions").upsert({
    institution_id: institutionId,
    provider: submission.id.provider,
    external_id: submission.id.externalId,
    assignment_external_id: submission.assignmentId.externalId,
    student_external_id: submission.studentId,
    submitted_at: submission.submittedAt,
    status: submission.status,
    source_url: submission.sourceUrl,
    updated_at: new Date().toISOString(),
    raw: submission,
  }, { onConflict: "institution_id,provider,external_id" });

  if (error) throw error;
}

async function persistGrade(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  institutionId: string,
  grade: LmsGradeRecord,
) {
  const { error } = await supabaseAdmin.from("lms_grades").upsert({
    institution_id: institutionId,
    provider: grade.id.provider,
    external_id: grade.id.externalId,
    submission_external_id: grade.submissionId.externalId,
    score: grade.score,
    graded_at: grade.gradedAt,
    updated_at: new Date().toISOString(),
    raw: grade,
  }, { onConflict: "institution_id,provider,external_id" });

  if (error) throw error;
}

async function persistTimingEvent(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  institutionId: string,
  event: LmsTimingEvent,
) {
  const { error } = await supabaseAdmin.from("lms_timing_events").upsert({
    institution_id: institutionId,
    provider: event.id.provider,
    external_id: event.id.externalId,
    course_external_id: event.submissionId.externalId.split(":")[0] ?? event.submissionId.externalId,
    submission_external_id: event.submissionId.externalId,
    event_type: event.eventType,
    occurred_at: event.occurredAt,
    source: event.source,
    raw: event,
  }, { onConflict: "institution_id,provider,external_id" });

  if (error) throw error;
}

async function persistEngagementEvent(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  institutionId: string,
  event: LmsEngagementEvent,
) {
  const { error } = await supabaseAdmin.from("lms_engagement_events").upsert({
    institution_id: institutionId,
    provider: event.id.provider,
    external_id: event.id.externalId,
    course_external_id: event.courseId.externalId,
    student_external_id: event.studentId,
    event_type: event.eventType,
    occurred_at: event.occurredAt,
    metadata: event.metadata,
    raw: event,
  }, { onConflict: "institution_id,provider,external_id" });

  if (error) throw error;
}

async function syncProvider(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  request: LmsSyncRequest,
  institution: { id: string; slug: string; name: string },
  provider: LmsProviderId,
) {
  const connection = await resolveConnection(supabaseAdmin, provider, institution.id);
  const config = resolveLmsSyncConfig();
  const baseUrl = connection?.base_url?.trim()
    || (provider === "canvas"
      ? config.canvasBaseUrl?.trim()
      : provider === "blackboard"
      ? config.blackboardBaseUrl?.trim()
      : config.moodleBaseUrl?.trim())
    || "";
  if (!baseUrl) {
    throw new LmsProviderNotConfiguredError(provider);
  }

  const accessToken = await resolveLmsProviderToken(supabaseAdmin, provider, institution.id, {
    accessTokenSecretName: connection?.access_token_secret_name ?? null,
  }) ?? (provider === "canvas"
    ? config.canvasAccessToken?.trim()
    : "") ?? "";
  if (!accessToken) {
    throw new LmsProviderNotConfiguredError(provider);
  }

  const adapter = createProviderAdapter(provider, {
    institution_id: institution.id,
    provider,
    base_url: baseUrl,
    access_token_secret_name: connection?.access_token_secret_name ?? null,
    enabled: connection?.enabled ?? true,
    metadata: connection?.metadata ?? null,
  }, accessToken);

  const summary = emptySummary();
  const warnings: string[] = [];
  const runId = await createLmsSyncRun(supabaseAdmin, {
    provider,
    institutionId: institution.id,
    syncMode: request.syncMode,
    status: "running",
    startedAt: new Date().toISOString(),
    summary,
    warnings,
    errorMessage: null,
  });

  try {
    const courseFilter = request.courseId ?? null;
    const assignmentFilter = request.assignmentId ?? null;
    const courses = courseFilter
      ? (await adapter.pullCourses()).filter((course) => course.id.externalId === courseFilter)
      : await adapter.pullCourses();

    for (const course of courses) {
      await persistCourse(supabaseAdmin, institution.id, course);
      summary.coursesSynced += 1;
      await recordLmsAuditEvent(supabaseAdmin, {
        institutionId: institution.id,
        provider,
        entityType: "course",
        entityExternalId: course.id.externalId,
        eventType: "synced",
        payload: { title: course.title, code: course.code },
      });
      await upsertLmsSyncCursor(supabaseAdmin, {
        institutionId: institution.id,
        provider,
        scopeKey: `course:${course.id.externalId}`,
        cursorState: {
          lastSyncedAt: new Date().toISOString(),
          syncMode: request.syncMode,
        },
      });

      const timingEvents = await adapter.pullTimingEvents(course.id.externalId);
      const engagementEvents = await adapter.pullEngagementEvents(course.id.externalId);

      for (const event of timingEvents.filter((item) => !assignmentFilter || item.id.externalId.startsWith(`${course.id.externalId}:${assignmentFilter}`))) {
        await persistTimingEvent(supabaseAdmin, institution.id, event);
        summary.eventsSynced += 1;
      }

      for (const event of engagementEvents) {
        await persistEngagementEvent(supabaseAdmin, institution.id, event);
        summary.eventsSynced += 1;
      }

      if (request.syncMode === "events") {
        continue;
      }

      const assignments = await adapter.pullAssignments(course.id.externalId);
      for (const assignment of assignments.filter((item) => !assignmentFilter || item.id.externalId === `${course.id.externalId}:${assignmentFilter}`)) {
        await persistAssignment(supabaseAdmin, institution.id, assignment);
        summary.assignmentsSynced += 1;

        const submissions = await adapter.pullSubmissions(assignment.id.externalId);
        const grades = await adapter.pullGrades(assignment.id.externalId);

        for (const submission of submissions) {
          await persistSubmission(supabaseAdmin, institution.id, submission);
          summary.submissionsSynced += 1;
        }

        for (const grade of grades) {
          await persistGrade(supabaseAdmin, institution.id, grade);
          summary.gradesSynced += 1;
        }
      }
    }

    await finishLmsSyncRun(supabaseAdmin, runId, {
      status: "succeeded",
      summary,
      warnings,
      completedAt: new Date().toISOString(),
    });

    return {
      success: true,
      provider,
      syncMode: request.syncMode,
      message: `${provider[0].toUpperCase()}${provider.slice(1)} sync completed for ${institution.slug}.`,
      summary,
      warnings,
    } satisfies LmsSyncResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : `${provider} sync failed`;
    await finishLmsSyncRun(supabaseAdmin, runId, {
      status: "failed",
      summary,
      warnings,
      errorMessage: message,
      completedAt: new Date().toISOString(),
    });
    throw error;
  }
}

export async function runLmsSync(request: LmsSyncRequest): Promise<LmsSyncResponse> {
  const config = resolveLmsSyncConfig();
  if (!config.enabled) {
    throw new LmsIntegrationError("LMS sync is disabled.");
  }

  const supabaseAdmin = createAdminClient();
  const institution = await resolveInstitution(supabaseAdmin, request);

  logInfo("Starting LMS sync", {
    provider: request.provider,
    institutionId: institution.id,
    institutionSlug: institution.slug,
    syncMode: request.syncMode,
  });

  const response = await syncProvider(supabaseAdmin, request, institution, request.provider);
  logInfo("Completed LMS sync", {
    provider: request.provider,
    institutionId: institution.id,
    summary: response.summary,
  });

  return response;
}
