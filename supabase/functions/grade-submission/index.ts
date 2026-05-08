import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, jsonError, requireLecturer, HttpError } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { logError, logInfo, logWarn } from "../_shared/log.ts";
import {
  DOCUMENT_EXTRACTION_ERROR_MESSAGE,
  logDocumentExtractionResult,
  extractSubmissionDocument,
} from "../_shared/document-extraction.ts";
import { getModel } from "../_shared/openai.ts";
import { applyRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";
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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) return createCorsForbiddenResponse();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { supabase: userSupabase, user, roles: actorRoles } = await requireLecturer(req);
    const rateLimit = applyRateLimit(req, {
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
    const gradingModel = getModel("OPENAI_GRADING_MODEL", "gpt-5.4-mini");
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

    const supabaseAdmin = createAdminClient();
    const actorIsAdmin = actorRoles.includes("admin");
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
      results.push({
        submissionId: sub.id,
        error: "Submission file URL is missing. Re-upload the document and try again.",
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
        logError("Grading error for submission", gradeErr, {
          submissionId: sub.id,
        });
        results.push({
          submissionId: sub.id,
          error: gradeErr instanceof Error ? gradeErr.message : String(gradeErr),
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
