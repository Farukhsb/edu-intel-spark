import { createAdminClient, jsonError, requireLecturer, HttpError } from "../_shared/auth.ts";
import { getEnv } from "../_shared/env.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { logError, logInfo, logWarn } from "../_shared/log.ts";
import {
  DOCUMENT_EXTRACTION_ERROR_MESSAGE,
  logDocumentExtractionResult,
  extractSubmissionDocument,
  type DocumentExtractionResult,
} from "../_shared/document-extraction.ts";
import { getModel } from "../_shared/openai.ts";
import { applySharedRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";
import { parseGradeSubmissionRequestPayload } from "../_shared/grade-submission-request.ts";
import { buildGradingErrorEventPayload, classifyGradingError } from "./error-telemetry.ts";
import {
  type CachedGradeResult,
} from "./orchestration.ts";
import {
  isSupportedSubmissionFile,
  normalizeSubmissionStoragePath,
} from "./grading-support.ts";
import {
  buildExistingGradesByFingerprint,
  loadAssignmentForGrading,
  loadAssignmentSubmissionRows,
  loadExistingGradesForGrading,
  loadRequestedSubmissionsForGrading,
  normalizeRubricForAssignment,
} from "./request-stage.ts";
import { gradeSingleSubmission } from "./submission-stage.ts";
import { PdfEvidenceAdequacyError } from "./submission-stage.ts";
import type { FetchSubmissionContentForGrading } from "./types.ts";

const CONFIDENCE_THRESHOLD = 0.7;
const DEFAULT_GRADING_PASSES = 3;
const MAX_GRADING_PASSES = 5;
const PASS_SPREAD_REVIEW_THRESHOLD_RATIO = 0.08;
const PASS_SPREAD_REVIEW_THRESHOLD_MIN = 8;
const EXTRACTION_FAILURE_TELEMETRY_MESSAGE = "Document extraction failed before grading.";
const EXTRACTION_QUALITY_FAILURE_TELEMETRY_MESSAGE = "Extracted document text was not reliable enough for grading.";

function getConfiguredGradingPasses() {
  const configured = Number(getEnv("OPENAI_GRADING_PASSES") || DEFAULT_GRADING_PASSES);
  if (!Number.isFinite(configured)) return DEFAULT_GRADING_PASSES;

  const normalized = Math.trunc(configured);
  if (normalized < 1) return 1;

  return Math.min(normalized, MAX_GRADING_PASSES);
}

function resolveGradingPasses(override: number | undefined) {
  const configuredPasses = getConfiguredGradingPasses();
  if (override === undefined) {
    return configuredPasses;
  }

  return Math.min(configuredPasses, override);
}

function getPassSpreadThreshold(maxScore: number) {
  return Math.max(PASS_SPREAD_REVIEW_THRESHOLD_MIN, Math.round(maxScore * PASS_SPREAD_REVIEW_THRESHOLD_RATIO));
}

type ExtractionFailureTelemetry = {
  extraction_method: string;
  file_type: string;
  mime_type: string;
  extracted_text_length: number;
  extraction_quality_score: number | null;
  extraction_quality_word_count: number | null;
  extraction_quality_readable_sentence_count: number | null;
  extraction_quality_suspicious_pdf_artifact_count: number | null;
  parser_error?: {
    class: string | null;
    message: string | null;
  } | null;
};

class ExtractionFailureError extends Error {
  telemetry: ExtractionFailureTelemetry;
  errorCode: "document_extraction_failed" | "extraction_quality_failed";
  safeErrorCategory: "document_processing_failure";

  constructor(params: {
    message: string;
    telemetry: ExtractionFailureTelemetry;
    errorCode: "document_extraction_failed" | "extraction_quality_failed";
  }) {
    super(params.message);
    this.name = "ExtractionFailureError";
    this.telemetry = params.telemetry;
    this.errorCode = params.errorCode;
    this.safeErrorCategory = "document_processing_failure";
  }
}

function isDocumentExtractionError(
  error: unknown,
): error is ExtractionFailureError | PdfEvidenceAdequacyError {
  return error instanceof ExtractionFailureError || error instanceof PdfEvidenceAdequacyError;
}

function sanitizeTelemetryString(value: string | null | undefined, maxLength = 200) {
  if (!value) return null;
  const sanitized = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maxLength);

  return sanitized || null;
}

function buildExtractionFailureTelemetry(extraction: DocumentExtractionResult): ExtractionFailureTelemetry {
  const parserErrorClass = extraction.extractionFailureReason === "extractor_error" && extraction.extractionWarning
    ? "ExtractionParserError"
    : null;
  const parserErrorMessage = extraction.extractionFailureReason === "extractor_error"
    ? sanitizeTelemetryString(extraction.extractionWarning)
    : null;

  return {
    extraction_method: extraction.extractionMethod ?? "unknown",
    file_type: extraction.fileType ?? "unknown",
    mime_type: extraction.mimeType ?? "application/octet-stream",
    extracted_text_length: extraction.extractedTextLength ?? 0,
    extraction_quality_score: extraction.extractionQuality?.qualityScore ?? null,
    extraction_quality_word_count: extraction.extractionQuality?.wordCount ?? null,
    extraction_quality_readable_sentence_count:
      extraction.extractionQuality?.readableSentenceCount ?? null,
    extraction_quality_suspicious_pdf_artifact_count:
      extraction.extractionQuality?.suspiciousPdfArtifactCount ?? null,
    parser_error:
      parserErrorClass || parserErrorMessage
        ? {
          class: parserErrorClass,
          message: parserErrorMessage,
        }
        : null,
  };
}

async function recordGradingFailureAudit({
  supabaseAdmin,
  submissionId,
  userId,
  actorRole,
  assignmentId,
  reason,
  gradingModel,
  forceRegenerate,
}: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  submissionId: string;
  userId: string;
  actorRole: "admin" | "lecturer";
  assignmentId: string;
  reason: string;
  gradingModel: string;
  forceRegenerate: boolean;
}) {
  const { error } = await supabaseAdmin.from("grade_audit_log").insert({
    submission_id: submissionId,
    changed_by: userId,
    event_type: "grading_failed",
    actor_role: actorRole,
    new_values: {
      assignment_id: assignmentId,
      grading_model: gradingModel,
      force_regenerate: forceRegenerate,
    },
    reason,
  });

  if (error) {
    logWarn("grade-submission failure audit insert failed", {
      submissionId,
      assignmentId,
      error,
    });
  }
}

async function recordGradingErrorEvent({
  supabaseAdmin,
  submissionId,
  assignmentId,
  userId,
  provider,
  reason,
  errorCode,
  safeErrorCategory,
  safeErrorMessage,
}: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  submissionId: string;
  assignmentId: string;
  userId: string;
  provider: string;
  reason: string;
  errorCode?: string;
  safeErrorCategory?: string;
  safeErrorMessage?: string;
}) {
  const { error } = await supabaseAdmin.from("grading_error_events").insert(
    buildGradingErrorEventPayload({
      submissionId,
      assignmentId,
      userId,
      provider,
      reason,
      errorCode,
      safeErrorCategory,
      safeErrorMessage,
    }),
  );

  if (error) {
    logWarn("grade-submission grading error telemetry insert failed", {
      submissionId,
      assignmentId,
      error,
    });
  }
}

type WorkflowRunTelemetryStatus = "running" | "succeeded" | "failed";

async function recordGradingWorkflowRun({
  supabaseAdmin,
  workflowRunId,
  phase,
  assignmentId,
  submissionId,
  institutionId,
  triggeredBy,
  model,
  status,
  providerRetryCount,
  gradingPassCount,
  failureCategory,
  startedAt,
  finishedAt,
  durationMs,
  submissionCount,
  provider = "openai",
}: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  workflowRunId?: string | null;
  phase: "running" | "terminal";
  assignmentId: string;
  submissionId: string | null;
  institutionId: string;
  triggeredBy: string | null;
  model: string;
  status: WorkflowRunTelemetryStatus;
  providerRetryCount: number;
  gradingPassCount: number;
  failureCategory?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
  submissionCount: number;
  provider?: string;
}) {
  const resolvedWorkflowRunId = phase === "running" && workflowRunId ? workflowRunId : crypto.randomUUID();
  const payload = {
    id: resolvedWorkflowRunId,
    workflow_name: "grade-submission",
    assignment_id: assignmentId,
    submission_id: submissionId,
    institution_id: institutionId,
    triggered_by: triggeredBy,
    provider,
    model,
    status,
    retry_count: Math.max(0, Math.trunc(providerRetryCount)),
    failure_category: failureCategory ?? null,
    started_at: startedAt,
    finished_at: finishedAt ?? null,
    duration_ms: durationMs ?? null,
    details: {
      submission_count: submissionCount,
      grading_pass_count: Math.max(1, Math.trunc(gradingPassCount)),
      provider_retry_count: Math.max(0, Math.trunc(providerRetryCount)),
      parent_workflow_run_id: phase === "terminal" ? workflowRunId ?? null : null,
      workflow_run_phase: phase,
      workflow: "grade-submission",
      provider,
      model,
      status,
    },
  };

  const { error } = await supabaseAdmin
    .from("workflow_runs")
    .insert({
      ...payload,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    logWarn("grade-submission workflow run telemetry insert failed", {
      assignmentId,
      phase,
      error,
    });
    return null;
  }

  return resolvedWorkflowRunId;
}

function getWorkflowRunGradingPassCount(gradingPasses: number) {
  return Math.max(1, Math.trunc(gradingPasses));
}

async function fetchSubmissionContent(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  sub: { file_url: string; file_name: string | null },
): ReturnType<FetchSubmissionContentForGrading> {
  const normalizedPath = normalizeSubmissionStoragePath(sub.file_url);
  if (!normalizedPath) {
    throw new Error("Submission file URL is missing. Re-upload the document and try again.");
  }

  if (!isSupportedSubmissionFile(sub.file_name, normalizedPath)) {
    throw new Error("Submission file type is not supported. Upload a readable PDF, DOCX, TXT, or supported code file.");
  }

  const { data: fileData, error: dlError } = await supabaseAdmin.storage
    .from("submissions")
    .download(normalizedPath);

  if (dlError || !fileData) {
    const message = dlError?.message?.toLowerCase() ?? "";
    if (message.includes("not found") || message.includes("404")) {
      throw new Error("Submission file could not be found in storage. Re-upload the document and try again.");
    }
    throw new Error("Submission file could not be downloaded. Re-upload the document and try again.");
  }

  const extraction = await extractSubmissionDocument({
    fileName: sub.file_name,
    mimeType: fileData.type,
    fileData,
  });

  logDocumentExtractionResult("grade-submission", extraction);

  if (!extraction.success) {
    const telemetry = buildExtractionFailureTelemetry(extraction);
    const isQualityFailure = extraction.extractionFailureReason === "unreadable_pdf" ||
      extraction.extractionFailureReason === "extracted_text_unusable" ||
      extraction.extractionFailureReason === "extracted_text_too_short" ||
      extraction.extractionFailureReason === "binary_like_content";
    logWarn("grade-submission extraction rejected", {
      fileName: extraction.fileName,
      fileType: extraction.fileType,
      mimeType: extraction.mimeType,
      extractionFailureReason: extraction.extractionFailureReason,
      errorCode: isQualityFailure ? "extraction_quality_failed" : "document_extraction_failed",
      safeErrorCategory: "document_processing_failure",
      ...telemetry,
    });
    throw new ExtractionFailureError({
      message: extraction.extractionError || DOCUMENT_EXTRACTION_ERROR_MESSAGE,
      telemetry,
      errorCode: isQualityFailure ? "extraction_quality_failed" : "document_extraction_failed",
    });
  }

  return {
    extractedText: extraction.extractedText,
    extractionMetadata: {
      file_name: extraction.fileName,
      file_type: extraction.fileType,
      mime_type: extraction.mimeType,
      extraction_method: extraction.extractionMethod,
      extraction_failure_reason: extraction.extractionFailureReason,
      extracted_text_length: extraction.extractedTextLength,
      extraction_success: extraction.success,
      extraction_warning: extraction.extractionWarning,
      extraction_error: extraction.extractionError,
      extraction_quality_score: extraction.extractionQuality?.qualityScore ?? null,
      extraction_quality_word_count: extraction.extractionQuality?.wordCount ?? null,
      extraction_quality_readable_sentence_count:
        extraction.extractionQuality?.readableSentenceCount ?? null,
      extraction_quality_suspicious_pdf_artifact_count:
        extraction.extractionQuality?.suspiciousPdfArtifactCount ?? null,
    },
  };
}

async function persistGradedSubmissionResult({
  supabaseAdmin,
  submissionId,
  gradingResult,
}: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  submissionId: string;
  gradingResult: {
    score?: number | null;
    feedback?: string | null;
    breakdown?: unknown;
    assignmentType?: string | null;
    gradingConfidence?: number | null;
    gradingMetadata?: Record<string, unknown> | null;
    requiresLecturerReview?: boolean;
  };
}) {
  const { error: gradeWriteError } = await supabaseAdmin.from("grades").upsert(
    {
      submission_id: submissionId,
      ai_score: gradingResult.score ?? null,
      ai_feedback: gradingResult.feedback ?? null,
      ai_breakdown: gradingResult.breakdown ?? null,
      assignment_type: gradingResult.assignmentType ?? null,
      grading_confidence: gradingResult.gradingConfidence ?? null,
      grading_metadata: gradingResult.gradingMetadata ?? {},
    },
    { onConflict: "submission_id" },
  );

  if (gradeWriteError) {
    throw new Error(gradeWriteError.message || "The AI grade could not be saved.");
  }

  const nextStatus = gradingResult.requiresLecturerReview ? "first_review" : "ai_graded";
  const { error: submissionWriteError } = await supabaseAdmin
    .from("submissions")
    .update({ status: nextStatus })
    .eq("id", submissionId);

  if (submissionWriteError) {
    logWarn("grade-submission status update failed after grade save", {
      submissionId,
      nextStatus,
      error: submissionWriteError,
    });
  }
}

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
    const assignmentClient = actorIsAdmin ? supabaseAdmin : userSupabase;
    const { data: assignment, error: assignmentError } = await loadAssignmentForGrading(
      assignmentClient,
      requestedAssignmentId,
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
          gradingResult,
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
