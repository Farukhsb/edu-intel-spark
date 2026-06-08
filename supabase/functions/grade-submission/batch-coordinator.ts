import { createAdminClient, jsonError, requireLecturer, HttpError } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { logError, logInfo, logWarn } from "../_shared/log.ts";
import { getModel } from "../_shared/openai.ts";
import { applySharedRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";
import { parseGradeSubmissionRequestPayload } from "../_shared/grade-submission-request.ts";
import { buildGradingErrorEventPayload, classifyGradingError } from "./error-telemetry.ts";
import { type CachedGradeResult } from "./orchestration.ts";
import { isSupportedSubmissionFile, normalizeSubmissionStoragePath } from "./grading-support.ts";
import { buildExistingGradesByFingerprint, loadAssignmentForGrading, loadAssignmentSubmissionRows, loadExistingGradesForGrading, loadRequestedSubmissionsForGrading, normalizeRubricForAssignment } from "./request-stage.ts";
import { gradeSingleSubmission } from "./submission-stage.ts";
import { getConfiguredGradingPasses, resolveGradingPasses, getPassSpreadThreshold, isDocumentExtractionError, recordGradingFailureAudit, recordGradingErrorEvent, recordGradingAuditEvent, recordGradingWorkflowRun, getWorkflowRunGradingPassCount, fetchSubmissionContent, persistGradedSubmissionResult } from "./batch-support.ts";
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) return createCorsForbiddenResponse();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let supabaseAdmin: ReturnType<typeof createAdminClient> | null = null;
  let workflowRunId: string | null = null;
  let workflowRunStartedAt: string | null = null;
  let workflowRunAssignmentId: string | null = null;
  let workflowRunInstitutionId: string | null = null;
  let workflowRunSubmissionId: string | null = null;
  let workflowRunSubmissionCount = 0;
  let workflowRunModel = "";
  let workflowRunProviderRetryCount = 0;
  let workflowRunGradingPassCount = 0;
  let actorUserId: string | null = null;
  try {
    const { supabase: userSupabase, user, roles: actorRoles } = await requireLecturer(req);
    actorUserId = user.id;
    supabaseAdmin = createAdminClient();
    const rateLimit = await applySharedRateLimit(supabaseAdmin, req, {
      scope: "grade-submission",
      limit: 5,
      windowMs: 60_000,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      logWarn("Rate limit exceeded", { function: "grade-submission", identifierType: rateLimit.identifierType });
      return createRateLimitResponse(corsHeaders, rateLimit.retryAfterSeconds);
    }
    const body = await req.json().catch(() => null);
    const rawBody = body && typeof body === "object" ? body as Record<string, unknown> : null;
    const parsedRequest = parseGradeSubmissionRequestPayload(body);
    if (!parsedRequest.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request format",
          details: parsedRequest.error.issues,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const { assignmentId, submissionId, submissionIds, force_regenerate, grading_passes_override } = parsedRequest.data;
    const gradingModel = getModel("OPENAI_GRADING_MODEL", "gpt-4o-mini");
    const gradingPasses = resolveGradingPasses(grading_passes_override);
    const forceRegenerate = force_regenerate ?? false;
    const regradeReason =
      typeof rawBody?.regrade_reason === "string" && rawBody.regrade_reason.trim()
        ? rawBody.regrade_reason.trim()
        : forceRegenerate
          ? "Forced re-grade requested."
          : "Grading input changed.";
    const requestedAssignmentId = assignmentId ?? null;
    const requestedSubmissionIds = submissionIds ?? (submissionId ? [submissionId] : []);
    if (!requestedAssignmentId || requestedSubmissionIds.length === 0) {
      throw new HttpError(400, "Missing assignment or submissions data");
    }
    const actorIsAdmin = actorRoles.includes("admin");
    const actorRole = actorIsAdmin ? "admin" : "lecturer";
    if (forceRegenerate && !actorIsAdmin) {
      throw new HttpError(403, "Only admins can force AI re-grading");
    }
    const { data: actorProfile, error: actorProfileError } = await supabase
      .from("profiles")
      .select("id, institution_id, institutions:institution_id (slug)")
      .eq("id", user.id)
      .maybeSingle();
    if (actorProfileError) {
      throw new HttpError(403, "Admin profile could not be resolved");
    }
    const institutionId = actorProfile?.institution_id ?? null;
    if (!institutionId) {
      throw new HttpError(403, "Admin institution could not be resolved");
    }
    const assignmentClient = actorIsAdmin ? supabaseAdmin : userSupabase;
    const { data: assignment, error: assignmentError } = await loadAssignmentForGrading(
      assignmentClient,
      requestedAssignmentId,
      institutionId,
    );
    if (assignmentError) {
      logError("grade-submission assignment query failed", assignmentError, {
        assignmentId: requestedAssignmentId,
        requestedSubmissionIds,
      });
      throw new Error("Failed to load assignment");
    }
    if (!assignment) {
      throw new HttpError(403, "You do not have grading access to this assignment.");
    }
    workflowRunStartedAt = new Date().toISOString();
    workflowRunAssignmentId = assignment.id;
    workflowRunInstitutionId = assignment.institution_id ?? null;
    workflowRunSubmissionId = requestedSubmissionIds[0] ?? null;
    workflowRunSubmissionCount = requestedSubmissionIds.length;
    workflowRunModel = gradingModel;
    workflowRunProviderRetryCount = 0;
    workflowRunGradingPassCount = getWorkflowRunGradingPassCount(gradingPasses);
    if (!workflowRunInstitutionId) {
      logWarn("grade-submission workflow run telemetry skipped because assignment has no institution", {
        assignmentId: requestedAssignmentId,
      });
    } else {
      workflowRunId = await recordGradingWorkflowRun({
        supabaseAdmin,
        phase: "running",
        assignmentId: workflowRunAssignmentId,
        submissionId: workflowRunSubmissionId,
        institutionId: workflowRunInstitutionId,
        triggeredBy: user.id,
        model: workflowRunModel,
        status: "running",
        providerRetryCount: workflowRunProviderRetryCount,
        gradingPassCount: workflowRunGradingPassCount,
        startedAt: workflowRunStartedAt,
        submissionCount: workflowRunSubmissionCount,
      });
    }
    const { normalizedRubric, rubricText } = normalizeRubricForAssignment(assignment);
    const submissionClient = actorIsAdmin ? supabaseAdmin : userSupabase;
    const gradesClient = actorIsAdmin ? supabaseAdmin : userSupabase;
    const { data: submissions, error: submissionsError } = await loadRequestedSubmissionsForGrading(
      submissionClient,
      requestedAssignmentId,
      requestedSubmissionIds,
      institutionId,
    );
    if (submissionsError) {
      logError("grade-submission submissions query failed", submissionsError, {
        assignmentId: requestedAssignmentId,
        requestedSubmissionIds,
      });
      throw new Error("Failed to load submissions");
    }
    if (!submissions || submissions.length !== requestedSubmissionIds.length) {
      throw new HttpError(403, "One or more submissions are not accessible");
    }
    const {
      data: assignmentSubmissionRows,
      error: assignmentSubmissionIdsError,
      assignmentSubmissionIds,
      assignmentSubmissionsById,
    } = await loadAssignmentSubmissionRows(
      submissionClient,
      requestedAssignmentId,
      institutionId,
    );
    if (assignmentSubmissionIdsError) {
      logError("grade-submission assignment submissions query failed", assignmentSubmissionIdsError, {
        assignmentId: requestedAssignmentId,
      });
      throw new Error("Failed to load assignment submissions");
    }
    const { data: existingGradeRows, error: existingGradesError, existingGradesBySubmission } =
      await loadExistingGradesForGrading(
        gradesClient,
        assignmentSubmissionIds.length > 0 ? assignmentSubmissionIds : requestedSubmissionIds,
        institutionId,
      );
    if (existingGradesError) {
      logError("grade-submission existing grades query failed", existingGradesError, {
        assignmentId: requestedAssignmentId,
        requestedSubmissionIds,
      });
      throw new Error("Failed to load existing grades");
    }
    const existingGradesByFingerprint = await buildExistingGradesByFingerprint({
      assignment,
      existingGradeRows,
      assignmentSubmissionsById,
      normalizedRubric,
      fetchSubmissionContent: (submission) => fetchSubmissionContent(supabaseAdmin, submission),
    });
    const results: Array<Record<string, unknown>> = [];
    const generatedResultsByFingerprint = new Map<string, CachedGradeResult>();
    let workflowRunFailureCount = 0;
    let workflowRunFailureCategory: string | null = null;
    const invalidSubmissionPaths = submissions.filter((sub) => !normalizeSubmissionStoragePath(sub.file_url));
    for (const sub of invalidSubmissionPaths) {
      const reason = "Submission file URL is missing. Re-upload the document and try again.";
      workflowRunFailureCount += 1;
      workflowRunFailureCategory = workflowRunFailureCategory || "submission_access_failure";
      await recordGradingFailureAudit({
        supabaseAdmin,
        submissionId: sub.id,
        userId: user.id,
        institutionId,
        actorRole,
        assignmentId: requestedAssignmentId,
        reason,
        gradingModel,
        forceRegenerate,
      });
      await recordGradingErrorEvent({
        supabaseAdmin,
        submissionId: sub.id,
        assignmentId: requestedAssignmentId,
        userId: user.id,
        institutionId,
        provider: "openai",
        reason,
      });
      results.push({
        submissionId: sub.id,
        error: reason,
        success: false,
      });
    }
    for (const sub of submissions.filter((item) => normalizeSubmissionStoragePath(item.file_url))) {
      try {
        await recordGradingAuditEvent({
          supabaseAdmin,
          submissionId: sub.id,
          userId: user.id,
          institutionId,
          actorRole,
          eventType: "grading_started",
          previousValues: {
            status: sub.status,
          },
          newValues: {
            status: "ai_grading",
            grading_model: gradingModel,
            grading_passes: gradingPasses,
          },
          reason: "AI grading workflow started.",
        });
        const gradingResult = await gradeSingleSubmission({
          sub,
          assignment,
          existingGrade: existingGradesBySubmission.get(sub.id) ?? null,
          existingGradesByFingerprint,
          generatedResultsByFingerprint,
          normalizedRubric,
          rubricText,
          gradingModel,
          forceRegenerate,
          regradeReason,
          confidenceThreshold: CONFIDENCE_THRESHOLD,
          gradingPasses,
          getPassSpreadThreshold,
          fetchSubmissionContent: (submission) => fetchSubmissionContent(supabaseAdmin, submission),
        });
        await persistGradedSubmissionResult({
          supabaseAdmin,
          submissionId: sub.id,
          institutionId,
          gradingResult,
        });
        await recordGradingAuditEvent({
          supabaseAdmin,
          submissionId: sub.id,
          userId: user.id,
          institutionId,
          actorRole,
          eventType: "grading_completed",
          previousValues: {
            status: "ai_grading",
          },
          newValues: {
            status: gradingResult.requiresLecturerReview ? "first_review" : "ai_graded",
            score: gradingResult.score ?? null,
            requires_lecturer_review: Boolean(gradingResult.requiresLecturerReview),
          },
          reason: "AI grading workflow completed.",
        });
        results.push(gradingResult);
      } catch (gradeErr) {
        const reason = gradeErr instanceof Error ? gradeErr.message : String(gradeErr);
        const gradingErrorCategory = gradeErr instanceof Error
          ? (isDocumentExtractionError(gradeErr) ? gradeErr.safeErrorCategory : classifyGradingError(reason).safeErrorCategory)
          : "grading_failure";
        workflowRunFailureCount += 1;
        workflowRunFailureCategory = workflowRunFailureCategory || gradingErrorCategory;
        logError("Grading error for submission", gradeErr, {
          submissionId: sub.id,
        });
        await recordGradingFailureAudit({
          supabaseAdmin,
          submissionId: sub.id,
          userId: user.id,
          institutionId,
          actorRole,
          assignmentId: requestedAssignmentId,
          reason,
          gradingModel,
          forceRegenerate,
        });
        await recordGradingErrorEvent({
          supabaseAdmin,
          submissionId: sub.id,
          assignmentId: requestedAssignmentId,
          userId: user.id,
          institutionId,
          provider: isDocumentExtractionError(gradeErr) ? "document_extraction" : "openai",
          reason,
          errorCode: isDocumentExtractionError(gradeErr) ? gradeErr.errorCode : undefined,
          safeErrorCategory: isDocumentExtractionError(gradeErr) ? gradeErr.safeErrorCategory : undefined,
          safeErrorMessage: isDocumentExtractionError(gradeErr)
            ? gradeErr.errorCode === "extraction_quality_failed"
              ? EXTRACTION_QUALITY_FAILURE_TELEMETRY_MESSAGE
              : EXTRACTION_FAILURE_TELEMETRY_MESSAGE
            : undefined,
        });
        results.push({
          submissionId: sub.id,
          error: reason,
          success: false,
        });
      }
    }
    if (supabaseAdmin && workflowRunStartedAt && workflowRunAssignmentId && workflowRunInstitutionId) {
      const workflowRunStatus: WorkflowRunTelemetryStatus =
        workflowRunFailureCount > 0 ? "failed" : "succeeded";
      await recordGradingWorkflowRun({
        supabaseAdmin,
        workflowRunId,
        phase: "terminal",
        assignmentId: workflowRunAssignmentId,
        submissionId: workflowRunSubmissionId,
        institutionId: workflowRunInstitutionId,
        triggeredBy: actorUserId,
        model: workflowRunModel,
        status: workflowRunStatus,
        providerRetryCount: workflowRunProviderRetryCount,
        gradingPassCount: workflowRunGradingPassCount,
        failureCategory: workflowRunFailureCount > 0 ? workflowRunFailureCategory : null,
        startedAt: workflowRunStartedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Math.max(0, Date.now() - new Date(workflowRunStartedAt).getTime()),
        submissionCount: workflowRunSubmissionCount,
      });
    }
    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (supabaseAdmin && workflowRunStartedAt && workflowRunAssignmentId && workflowRunInstitutionId) {
      const failureCategory = e instanceof Error
        ? classifyGradingError(e.message).safeErrorCategory
        : "grading_failure";
      await recordGradingWorkflowRun({
        supabaseAdmin,
        workflowRunId,
        phase: "terminal",
        assignmentId: workflowRunAssignmentId,
        submissionId: workflowRunSubmissionId,
        institutionId: workflowRunInstitutionId,
        triggeredBy: actorUserId,
        model: workflowRunModel || "gpt-4o-mini",
        status: "failed",
        providerRetryCount: workflowRunProviderRetryCount,
        gradingPassCount: workflowRunGradingPassCount,
        failureCategory,
        startedAt: workflowRunStartedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Math.max(0, Date.now() - new Date(workflowRunStartedAt).getTime()),
        submissionCount: workflowRunSubmissionCount,
      });
    }
    logError("grade-submission error", e);
    return jsonError(e, corsHeaders);
  }
});
