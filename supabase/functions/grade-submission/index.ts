import { createAdminClient, jsonError, requireLecturer, HttpError } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { logError, logInfo, logWarn } from "../_shared/log.ts";
import {
  DOCUMENT_EXTRACTION_ERROR_MESSAGE,
  logDocumentExtractionResult,
  extractSubmissionDocument,
} from "../_shared/document-extraction.ts";
import { getModel } from "../_shared/openai.ts";
import { applySharedRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";
import { parseGradeSubmissionRequestPayload } from "../_shared/grade-submission-request.ts";
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
import type { FetchSubmissionContentForGrading } from "./types.ts";

const CONFIDENCE_THRESHOLD = 0.7;
const GRADING_PASSES = 1;
const PASS_SPREAD_REVIEW_THRESHOLD_RATIO = 0.08;
const PASS_SPREAD_REVIEW_THRESHOLD_MIN = 8;

function getPassSpreadThreshold(maxScore: number) {
  return Math.max(PASS_SPREAD_REVIEW_THRESHOLD_MIN, Math.round(maxScore * PASS_SPREAD_REVIEW_THRESHOLD_RATIO));
}

function classifyGradingError(reason: string) {
  const normalizedReason = reason.toLowerCase();

  if (normalizedReason.includes("parse ai response")) {
    return { errorCode: "response_parse_failed", safeErrorCategory: "grading_failure" };
  }
  if (normalizedReason.includes("download")) {
    return { errorCode: "submission_download_failed", safeErrorCategory: "submission_access_failure" };
  }
  if (normalizedReason.includes("missing") && normalizedReason.includes("file url")) {
    return { errorCode: "submission_file_missing", safeErrorCategory: "submission_access_failure" };
  }
  if (normalizedReason.includes("supported")) {
    return { errorCode: "unsupported_submission_file", safeErrorCategory: "submission_validation_failure" };
  }
  if (normalizedReason.includes("extract")) {
    return { errorCode: "document_extraction_failed", safeErrorCategory: "document_processing_failure" };
  }

  return { errorCode: "grading_failed", safeErrorCategory: "grading_failure" };
}

function toSafeGradingErrorMessage(reason: string) {
  const normalizedReason = reason.toLowerCase();

  if (normalizedReason.includes("parse ai response")) {
    return "AI grading response could not be parsed.";
  }
  if (normalizedReason.includes("download")) {
    return "Submission file could not be downloaded.";
  }
  if (normalizedReason.includes("missing") && normalizedReason.includes("file url")) {
    return "Submission file URL is missing.";
  }
  if (normalizedReason.includes("supported")) {
    return "Submission file type is not supported.";
  }
  if (normalizedReason.includes("extract")) {
    return "Submission document extraction failed.";
  }

  return "AI grading failed for this submission.";
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
}: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  submissionId: string;
  assignmentId: string;
  userId: string;
  provider: string;
  reason: string;
}) {
  const classification = classifyGradingError(reason);
  const safeErrorMessage = toSafeGradingErrorMessage(reason);
  const { error } = await supabaseAdmin.from("grading_error_events").insert({
    submission_id: submissionId,
    assignment_id: assignmentId,
    user_id: userId,
    provider,
    error_code: classification.errorCode,
    // Keep telemetry messages short and safe. Do not store raw student text, prompts,
    // provider payloads, or secrets in grading_error_events.error_message.
    error_message: safeErrorMessage,
    safe_error_category: classification.safeErrorCategory,
  });

  if (error) {
    logWarn("grade-submission grading error telemetry insert failed", {
      submissionId,
      assignmentId,
      error,
    });
  }
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
    throw new Error(extraction.extractionError || DOCUMENT_EXTRACTION_ERROR_MESSAGE);
  }

  return {
    extractedText: extraction.extractedText,
    extractionMetadata: {
      file_name: extraction.fileName,
      file_type: extraction.fileType,
      mime_type: extraction.mimeType,
      extracted_text_length: extraction.extractedTextLength,
      extraction_success: extraction.success,
      extraction_warning: extraction.extractionWarning,
      extraction_error: extraction.extractionError,
    },
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) return createCorsForbiddenResponse();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { supabase: userSupabase, user, roles: actorRoles } = await requireLecturer(req);
    const supabaseAdmin = createAdminClient();
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

    const { assignmentId, submissionId, submissionIds, force_regenerate } = parsedRequest.data;
    const gradingModel = getModel("OPENAI_GRADING_MODEL", "gpt-4o-mini");
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
    const invalidSubmissionPaths = submissions.filter((sub) => !normalizeSubmissionStoragePath(sub.file_url));
    for (const sub of invalidSubmissionPaths) {
      const reason = "Submission file URL is missing. Re-upload the document and try again.";
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
        results.push(await gradeSingleSubmission({
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
          gradingPasses: GRADING_PASSES,
          getPassSpreadThreshold,
          fetchSubmissionContent: (submission) => fetchSubmissionContent(supabaseAdmin, submission),
        }));
      } catch (gradeErr) {
        const reason = gradeErr instanceof Error ? gradeErr.message : String(gradeErr);
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
          provider: "openai",
          reason,
        });
        results.push({
          submissionId: sub.id,
          error: reason,
          success: false,
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    logError("grade-submission error", e);
    return jsonError(e, corsHeaders);
  }
});
