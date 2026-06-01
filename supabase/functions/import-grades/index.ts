import { createAdminClient, jsonError, requireLecturer, HttpError } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { logError, logInfo, logWarn } from "../_shared/log.ts";
import { applySharedRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";
import { requirePostMethod } from "../_shared/http.ts";
import { loadAssignmentForGrading } from "../grade-submission/request-stage.ts";
import { buildCsvImportRows } from "./csv.ts";
import { confirmImport } from "./confirm.ts";
import { buildImageImportRows, purgeExpiredTempImportArtifacts } from "./images.ts";
import { buildImportPreview, toSubmissionCandidates } from "./preview.ts";
import { isHybridImportEnabled, readImportRequest } from "./request.ts";

const IMPORT_RATE_LIMIT_SCOPE = "import-grades";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) return createCorsForbiddenResponse();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const methodError = requirePostMethod(req, corsHeaders);
  if (methodError) return methodError;

  try {
    const { user, roles } = await requireLecturer(req);
    const supabaseAdmin = createAdminClient();
    const rateLimit = await applySharedRateLimit(supabaseAdmin, req, {
      scope: IMPORT_RATE_LIMIT_SCOPE,
      limit: 10,
      windowMs: 60_000,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      logWarn("Rate limit exceeded", { function: "import-grades", identifierType: rateLimit.identifierType });
      return createRateLimitResponse(corsHeaders, rateLimit.retryAfterSeconds);
    }

    if (!isHybridImportEnabled()) {
      return new Response(JSON.stringify({ error: "Hybrid grade import is not enabled." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await purgeExpiredTempImportArtifacts(supabaseAdmin);

    const request = await readImportRequest(req);
    if (!request.assignmentId) {
      throw new HttpError(400, "Missing assignmentId");
    }

    const actorIsAdmin = roles.includes("admin");
    const { data: assignment, error: assignmentError } = await loadAssignmentForGrading(
      supabaseAdmin,
      request.assignmentId,
    );

    if (assignmentError) {
      logError("import-grades assignment query failed", assignmentError, { assignmentId: request.assignmentId });
      throw new Error("Failed to load assignment");
    }

    if (!assignment) {
      throw new HttpError(404, "Assignment not found");
    }

    if (!actorIsAdmin && assignment.lecturer_id !== user.id) {
      throw new HttpError(403, "You do not have access to this assignment");
    }

    const submissionsRes = await supabaseAdmin
      .from("submissions")
      .select("id, student_name, student_email, submitted_at, status, file_name, file_url")
      .eq("assignment_id", request.assignmentId);

    if (submissionsRes.error) {
      logError("import-grades submissions query failed", submissionsRes.error, {
        assignmentId: request.assignmentId,
      });
      throw new Error("Failed to load assignment submissions");
    }

    const sourceRows = request.importMethod === "csv"
      ? await buildCsvImportRows({
        files: request.files,
        csvText: request.csvText,
        assignmentMaxScore: Number(assignment.max_score ?? 100),
      })
      : await buildImageImportRows({
        files: request.files,
        assignmentMaxScore: Number(assignment.max_score ?? 100),
      });

    const submissionCandidates = toSubmissionCandidates((submissionsRes.data ?? []) as Array<{
      id: string;
      student_name: string | null;
      student_email: string | null;
      submitted_at: string;
      status: string;
      file_name: string;
      file_url: string;
    }>);

    const { preview } = buildImportPreview({
      rows: sourceRows,
      submissions: submissionCandidates,
      assignmentMaxScore: Number(assignment.max_score ?? 100),
      allowSyntheticSubmissions: request.createMissingSubmissions,
    });

    if (!request.confirm) {
      logInfo("import-grades preview completed", {
        function: "import-grades",
        assignmentId: request.assignmentId,
        importMethod: request.importMethod,
        rowsProcessed: preview.summary.rowsProcessed,
        rowsAccepted: preview.summary.rowsAccepted,
        rowsRejected: preview.summary.rowsRejected,
      });

      return new Response(JSON.stringify({
        success: true,
        committed: false,
        assignmentId: request.assignmentId,
        importMethod: request.importMethod,
        summary: preview.summary,
        rows: preview.rows,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const confirmResponse = await confirmImport({
      supabaseAdmin,
      userId: user.id,
      assignmentId: request.assignmentId,
      assignmentTitle: assignment.title,
      corsHeaders,
      request,
      preview,
    });
    return confirmResponse;
  } catch (error) {
    logError("import-grades error", error);
    return jsonError(error, corsHeaders);
  }
});
