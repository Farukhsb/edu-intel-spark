import { createAdminClient, jsonError, requireLecturer, HttpError } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { logError, logInfo, logWarn } from "../_shared/log.ts";
import { createChatCompletion, getModel, parseJsonText } from "../_shared/openai.ts";
import { applySharedRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";
import { requirePostMethod } from "../_shared/http.ts";
import { loadAssignmentForGrading } from "../grade-submission/request-stage.ts";
import {
  buildGradeImportPreview,
  buildImportedGradePayload,
  buildSyntheticSubmissionFileUrl,
  parseGradeImportCsv,
  type GradeImportMethod,
  type GradeImportSourceRow,
  type SubmissionCandidate,
  summarizeRejectedRows,
} from "../_shared/grade-import.ts";

type ParsedImportRequest = {
  assignmentId: string;
  confirm: boolean;
  importMethod: GradeImportMethod;
  createMissingSubmissions: boolean;
  csvText: string | null;
  files: File[];
  sourceFileName: string | null;
};

const IMPORT_RATE_LIMIT_SCOPE = "import-grades";
const DEFAULT_IMPORT_MODEL = "gpt-4o-mini";
const HYBRID_IMPORT_ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

function readEnv(name: string) {
  if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    return Deno.env.get(name);
  }

  if (typeof process !== "undefined" && process.env) {
    return process.env[name];
  }

  return undefined;
}

function isHybridImportEnabled() {
  const value = readEnv("HYBRID_IMPORT_ENABLED");
  if (!value) return false;
  return HYBRID_IMPORT_ENABLED_VALUES.has(value.trim().toLowerCase());
}

function parseBoolean(value: FormDataEntryValue | null | undefined, defaultValue = false) {
  if (typeof value !== "string") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  return HYBRID_IMPORT_ENABLED_VALUES.has(normalized);
}

function sanitizeFilePathSegment(value: string) {
  return value
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "import";
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashFiles(method: GradeImportMethod, files: File[], csvText: string | null) {
  if (method === "csv") {
    if (files[0]) {
      return sha256Hex(await files[0].text());
    }

    return sha256Hex(csvText ?? "");
  }

  const chunks: string[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    chunks.push(`${file.name}:${file.type}:${Array.from(bytes).join(",")}`);
  }
  return sha256Hex(chunks.join("\n---\n"));
}

function guessImportMethod(files: File[], explicit: string | null) {
  if (explicit === "csv" || explicit === "image") {
    return explicit;
  }

  if (files.length === 0) return "csv";
  if (files.every((file) => file.type.startsWith("image/"))) return "image";
  return "csv";
}

async function readImportRequest(req: Request): Promise<ParsedImportRequest> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const files = formData
      .getAll("file")
      .filter((value): value is File => value instanceof File);
    const assignmentId = String(formData.get("assignmentId") ?? formData.get("assignment_id") ?? "").trim();
    const explicitMethod = String(formData.get("importMethod") ?? formData.get("import_method") ?? "").trim().toLowerCase();
    const csvTextValue = formData.get("csvText") ?? formData.get("csv_text");

    return {
      assignmentId,
      confirm: parseBoolean(formData.get("confirm"), false),
      importMethod: guessImportMethod(files, explicitMethod),
      createMissingSubmissions: parseBoolean(formData.get("createMissingSubmissions") ?? formData.get("create_missing_submissions"), true),
      csvText: typeof csvTextValue === "string" && csvTextValue.trim() ? csvTextValue : null,
      files,
      sourceFileName: files[0]?.name ?? null,
    };
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Invalid request format");
  }

  const raw = body as Record<string, unknown>;
  const assignmentId = typeof raw.assignmentId === "string"
    ? raw.assignmentId.trim()
    : typeof raw.assignment_id === "string"
      ? raw.assignment_id.trim()
      : "";
  const explicitMethod = typeof raw.importMethod === "string"
    ? raw.importMethod.trim().toLowerCase()
    : typeof raw.import_method === "string"
      ? raw.import_method.trim().toLowerCase()
      : "";
  const csvText = typeof raw.csvText === "string"
    ? raw.csvText
    : typeof raw.csv_text === "string"
      ? raw.csv_text
      : null;

  return {
    assignmentId,
    confirm: typeof raw.confirm === "boolean" ? raw.confirm : parseBoolean(typeof raw.confirm === "string" ? raw.confirm : null, false),
    importMethod: guessImportMethod([], explicitMethod),
    createMissingSubmissions: typeof raw.createMissingSubmissions === "boolean"
      ? raw.createMissingSubmissions
      : parseBoolean(
        typeof raw.create_missing_submissions === "string" ? raw.create_missing_submissions : null,
        true,
      ),
    csvText: typeof csvText === "string" && csvText.trim() ? csvText : null,
    files: [],
    sourceFileName: typeof raw.sourceFileName === "string" ? raw.sourceFileName : null,
  };
}

function toSubmissionCandidates(submissions: Array<{
  id: string;
  student_name: string | null;
  student_email: string | null;
  submitted_at: string;
  status: string;
  file_name: string;
  file_url: string;
}>): SubmissionCandidate[] {
  return submissions.map((submission) => ({
    id: submission.id,
    student_name: submission.student_name,
    student_email: submission.student_email,
    submitted_at: submission.submitted_at,
    status: submission.status,
    file_name: submission.file_name,
    file_url: submission.file_url,
  }));
}

function buildImageExtractionPrompt(maxScore: number) {
  return [
    "Extract the grade table from this image as JSON.",
    "Return a JSON object with a rows array.",
    "Each row must include student_name, student_email if visible, score, max_score, submission_date if visible, and notes if visible.",
    `Use ${maxScore} as the default max_score when the image does not show one clearly.`,
    "Return only valid JSON.",
  ].join(" ");
}

async function extractRowsFromImageFile(file: File, maxScore: number) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  const dataUrl = `data:${file.type || "image/png"};base64,${btoa(binary)}`;
  const model = getModel("OPENAI_IMPORT_MODEL", DEFAULT_IMPORT_MODEL);
  const response = await createChatCompletion({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You extract grade tables from lecture mark sheets and screenshots. Return JSON only.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: buildImageExtractionPrompt(maxScore) },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI image extraction failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const choice = Array.isArray(data.choices) ? data.choices[0] : null;
  const content = choice && typeof choice === "object" && choice !== null && "message" in choice &&
    typeof (choice as { message?: { content?: unknown } }).message?.content === "string"
    ? (choice as { message: { content: string } }).message.content
    : "";

  const parsed = parseJsonText(content || "{}");
  const rows = Array.isArray(parsed.rows) ? parsed.rows : Array.isArray(parsed) ? parsed : [];

  return rows.map<GradeImportSourceRow>((row: Record<string, unknown>, index: number) => {
    const studentName = typeof row.student_name === "string" ? row.student_name : typeof row.name === "string" ? row.name : "";
    const studentEmail = typeof row.student_email === "string"
      ? row.student_email
      : typeof row.email === "string"
        ? row.email
        : null;
    const scoreRaw = typeof row.score === "number" ? row.score : Number(row.score);
    const maxScoreRaw = typeof row.max_score === "number" ? row.max_score : Number(row.max_score);
    const submissionDate = typeof row.submission_date === "string" ? row.submission_date : null;
    const notes = typeof row.notes === "string" ? row.notes : null;
    return {
      rowNumber: index + 1,
      studentName,
      studentEmail,
      score: Number.isFinite(scoreRaw) ? scoreRaw : Number.NaN,
      maxScore: Number.isFinite(maxScoreRaw) && maxScoreRaw > 0 ? maxScoreRaw : maxScore,
      submissionDate,
      notes,
      raw: Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]),
      ),
    };
  });
}

async function buildImportRows(params: {
  importMethod: GradeImportMethod;
  files: File[];
  csvText: string | null;
  assignmentMaxScore: number;
}) {
  if (params.importMethod === "csv") {
    if (params.files.length > 1) {
      throw new HttpError(400, "CSV imports support a single file at a time");
    }

    if (params.files[0]) {
      const text = await params.files[0].text();
      return parseGradeImportCsv(text, params.assignmentMaxScore);
    }

    if (!params.csvText) {
      throw new HttpError(400, "CSV import requires a file or csvText");
    }

    return parseGradeImportCsv(params.csvText, params.assignmentMaxScore);
  }

  if (params.files.length === 0) {
    throw new HttpError(400, "Image imports require one or more uploaded files");
  }

  const extractedRows: GradeImportSourceRow[] = [];
  let rowOffset = 0;
  for (const file of params.files) {
    if (!file.type.startsWith("image/")) {
      throw new HttpError(400, "Image imports only accept image files");
    }

    const rows = await extractRowsFromImageFile(file, params.assignmentMaxScore);
    extractedRows.push(...rows.map((row) => ({
      ...row,
      rowNumber: row.rowNumber + rowOffset,
    })));
    rowOffset += rows.length;
  }

  return extractedRows;
}

async function loadExistingGrades(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  submissionIds: string[],
) {
  if (submissionIds.length === 0) {
    return new Map<string, {
      ai_score: number | null;
      ai_feedback: string | null;
      ai_breakdown: unknown;
      lecturer_score: number | null;
      lecturer_feedback: string | null;
      final_score: number | null;
      final_feedback: string | null;
      grading_confidence: number | null;
      grading_metadata: Record<string, unknown> | null;
      grade_source: string | null;
      source_metadata: Record<string, unknown> | null;
    }>();
  }

  const { data, error } = await supabaseAdmin
    .from("grades")
    .select("submission_id, ai_score, ai_feedback, ai_breakdown, lecturer_score, lecturer_feedback, final_score, final_feedback, grading_confidence, grading_metadata, grade_source, source_metadata")
    .in("submission_id", submissionIds);

  if (error) {
    throw error;
  }

  return new Map(
    (data ?? []).map((row: Record<string, unknown>) => [
      String(row.submission_id),
      {
        ai_score: typeof row.ai_score === "number" ? row.ai_score : null,
        ai_feedback: typeof row.ai_feedback === "string" ? row.ai_feedback : null,
        ai_breakdown: row.ai_breakdown ?? null,
        lecturer_score: typeof row.lecturer_score === "number" ? row.lecturer_score : null,
        lecturer_feedback: typeof row.lecturer_feedback === "string" ? row.lecturer_feedback : null,
        final_score: typeof row.final_score === "number" ? row.final_score : null,
        final_feedback: typeof row.final_feedback === "string" ? row.final_feedback : null,
        grading_confidence: typeof row.grading_confidence === "number" ? row.grading_confidence : null,
        grading_metadata: (row.grading_metadata && typeof row.grading_metadata === "object") ? row.grading_metadata as Record<string, unknown> : null,
        grade_source: typeof row.grade_source === "string" ? row.grade_source : null,
        source_metadata: (row.source_metadata && typeof row.source_metadata === "object") ? row.source_metadata as Record<string, unknown> : null,
      },
    ]),
  );
}

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

    const sourceRows = await buildImportRows({
      importMethod: request.importMethod,
      files: request.files,
      csvText: request.csvText,
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

    const preview = buildGradeImportPreview({
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
        rejectedRows: summarizeRejectedRows(preview.rows),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const acceptedRows = preview.rows.filter((row) => row.accepted);
    if (acceptedRows.length === 0) {
      throw new HttpError(400, "No valid rows were available to import");
    }

    const sourceFileName = request.sourceFileName ?? request.files[0]?.name ?? (request.importMethod === "csv" ? "grades.csv" : "grades-image");
    const sourceFileHash = await hashFiles(request.importMethod, request.files, request.csvText);
    const importId = crypto.randomUUID();
    const sourceFilePath = `grade-imports/${sanitizeFilePathSegment(importId)}/${sanitizeFilePathSegment(sourceFileName)}`;
    const importMetadata = {
      status: "in_progress",
      assignment_id: request.assignmentId,
      assignment_title: assignment.title,
      import_method: request.importMethod,
      create_missing_submissions: request.createMissingSubmissions,
      source_file_name: sourceFileName,
      source_file_hash: sourceFileHash,
      rows_processed: preview.summary.rowsProcessed,
      rows_accepted: preview.summary.rowsAccepted,
      rows_rejected: preview.summary.rowsRejected,
      rows_with_warnings: preview.summary.rowsWithWarnings,
      preview_only: false,
      created_missing_submissions: preview.summary.createdSyntheticSubmissions,
      matched_existing_submissions: preview.summary.matchedExistingSubmissions,
    };

    const { error: importInsertError } = await supabaseAdmin.from("grade_imports").insert({
      id: importId,
      imported_by: user.id,
      import_method: request.importMethod,
      file_path: sourceFilePath,
      rows_processed: preview.summary.rowsProcessed,
      rows_accepted: preview.summary.rowsAccepted,
      source_metadata: importMetadata,
    });

    if (importInsertError) {
      logError("import-grades import log insert failed", importInsertError, {
        assignmentId: request.assignmentId,
        importId,
      });
      throw new Error("Failed to create the import audit record");
    }

    const submissionRowsToCreate = acceptedRows.filter((row) => row.submissionAction === "create");
    for (const row of submissionRowsToCreate) {
      const submissionInsert = await supabaseAdmin.from("submissions").insert({
        assignment_id: request.assignmentId,
        student_name: row.studentName || null,
        student_email: row.studentEmail,
        file_name: `Imported grade ${row.rowNumber}`,
        file_url: buildSyntheticSubmissionFileUrl(importId, row.rowNumber),
        file_type: "import",
        status: "approved",
        submitted_at: row.submissionDate || new Date().toISOString(),
        uploaded_by: user.id,
      }).select("id");

      if (submissionInsert.error || !submissionInsert.data?.[0]?.id) {
        throw new Error(submissionInsert.error?.message || "Failed to create an imported submission record");
      }
      row.matchedSubmissionId = submissionInsert.data[0].id;
    }

    const submissionIds = acceptedRows
      .map((row) => row.matchedSubmissionId)
      .filter((value): value is string => Boolean(value));

    const existingGradesBySubmission = await loadExistingGrades(supabaseAdmin, submissionIds);

    for (const row of acceptedRows) {
      const submissionId = row.matchedSubmissionId;
      if (!submissionId) {
        throw new Error(`Missing submission linkage for row ${row.rowNumber}`);
      }

      const existingGrade = existingGradesBySubmission.get(submissionId) ?? null;
      const payload = buildImportedGradePayload({
        importId,
        row,
        submissionId,
        lecturerId: user.id,
        sourceFileName,
        sourceFileHash,
        importMethod: request.importMethod,
        existingGrade,
      });

      const { error: gradeUpsertError } = await supabaseAdmin.from("grades").upsert(
        {
          ...payload,
          submission_id: submissionId,
        },
        { onConflict: "submission_id" },
      );

      if (gradeUpsertError) {
        throw new Error(gradeUpsertError.message || "Failed to save an imported grade");
      }

      const { error: submissionUpdateError } = await supabaseAdmin
        .from("submissions")
        .update({
          status: "approved",
          student_name: row.studentName || null,
          student_email: row.studentEmail,
        })
        .eq("id", submissionId);

      if (submissionUpdateError) {
        logWarn("import-grades submission update failed", {
          assignmentId: request.assignmentId,
          importId,
          submissionId,
          error: submissionUpdateError,
        });
      }
    }

    const { error: importUpdateError } = await supabaseAdmin
      .from("grade_imports")
      .update({
        rows_processed: preview.summary.rowsProcessed,
        rows_accepted: preview.summary.rowsAccepted,
        source_metadata: {
          ...importMetadata,
          status: "completed",
          import_id: importId,
        },
      })
      .eq("id", importId);

    if (importUpdateError) {
      logWarn("import-grades import log update failed", {
        assignmentId: request.assignmentId,
        importId,
        error: importUpdateError,
      });
    }

    logInfo("import-grades completed", {
      function: "import-grades",
      assignmentId: request.assignmentId,
      importMethod: request.importMethod,
      rowsProcessed: preview.summary.rowsProcessed,
      rowsAccepted: preview.summary.rowsAccepted,
      rowsRejected: preview.summary.rowsRejected,
      createdSyntheticSubmissions: preview.summary.createdSyntheticSubmissions,
    });

    return new Response(JSON.stringify({
      success: true,
      committed: true,
      importId,
      assignmentId: request.assignmentId,
      importMethod: request.importMethod,
      summary: preview.summary,
      rows: preview.rows,
      rejectedRows: summarizeRejectedRows(preview.rows),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logError("import-grades error", error);
    return jsonError(error, corsHeaders);
  }
});
