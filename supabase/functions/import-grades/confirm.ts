import { createAdminClient, HttpError } from "../_shared/auth.ts";
import { logError, logInfo, logWarn } from "../_shared/log.ts";
import { buildImportedGradePayload, buildSyntheticSubmissionFileUrl, type GradeImportMethod, type GradeImportPreviewRow } from "../_shared/grade-import.ts";
import { chunkArray, getImportBatchSize, sanitizeFilePathSegment } from "./request.ts";
import { removeTempImageFiles, uploadTempImageFiles } from "./images.ts";

export async function hashFiles(method: GradeImportMethod, files: File[], csvText: string | null) {
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

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function loadExistingGrades(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  submissionIds: string[],
  institutionId: string,
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
    .eq("institution_id", institutionId)
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

export async function createImportedAssignment(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  userId: string;
  institutionId: string;
  title: string;
  moduleCode: string;
  maxScore: number;
  dueDate: string | null;
  description: string | null;
}) {
  const { data, error } = await params.supabaseAdmin
    .from("assignments")
    .insert({
      institution_id: params.institutionId,
      lecturer_id: params.userId,
      title: params.title,
      description: params.description,
      module_code: params.moduleCode || null,
      max_score: params.maxScore,
      due_date: params.dueDate,
      status: "draft",
      rubric: [],
    })
    .select("id, title, module_code, max_score, due_date")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create imported assignment");
  }

  return {
    id: data.id as string,
    title: data.title as string,
    moduleCode: (data.module_code as string | null) ?? null,
    maxScore: Number(data.max_score ?? params.maxScore),
    dueDate: (data.due_date as string | null) ?? null,
  };
}

export async function confirmImport(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  userId: string;
  institutionId: string;
  assignmentId: string;
  assignmentTitle: string;
  corsHeaders: HeadersInit;
  request: {
    importMethod: GradeImportMethod;
    createMissingSubmissions: boolean;
    csvText: string | null;
    files: File[];
    sourceFileName: string | null;
  };
  preview: {
    rows: GradeImportPreviewRow[];
    summary: {
      rowsProcessed: number;
      rowsAccepted: number;
      rowsRejected: number;
      matchedExistingSubmissions: number;
      createdSyntheticSubmissions: number;
      rowsWithWarnings: number;
    };
  };
}) {
  const acceptedRows = params.preview.rows.filter((row) => row.accepted);
  if (acceptedRows.length === 0) {
    throw new HttpError(400, "No valid rows were available to import");
  }

  const sourceFileName = params.request.sourceFileName ?? params.request.files[0]?.name ?? (params.request.importMethod === "csv" ? "grades.csv" : "grades-image");
  const sourceFileHash = await hashFiles(params.request.importMethod, params.request.files, params.request.csvText);
  const importId = crypto.randomUUID();
  const batchSize = getImportBatchSize();
  const tempImagePaths: string[] = [];

  try {
    if (params.request.importMethod === "image") {
      tempImagePaths.push(...await uploadTempImageFiles({
        supabaseAdmin: params.supabaseAdmin,
        importId,
        files: params.request.files,
      }));
    }

    const sourceFilePath = params.request.importMethod === "image"
      ? (tempImagePaths[0] ?? `grade-imports/${sanitizeFilePathSegment(importId)}/${sanitizeFilePathSegment(sourceFileName)}`)
      : `grade-imports/${sanitizeFilePathSegment(importId)}/${sanitizeFilePathSegment(sourceFileName)}`;
    const hasRubricColumns = params.preview.rows.some((row) => row.rubricBreakdown.length > 0);
    const importMetadata = {
      status: "in_progress",
      assignment_id: params.assignmentId,
      assignment_title: params.assignmentTitle,
      import_method: params.request.importMethod,
      create_missing_submissions: params.request.createMissingSubmissions,
      source_file_name: sourceFileName,
      source_file_hash: sourceFileHash,
      rows_processed: params.preview.summary.rowsProcessed,
      rows_accepted: params.preview.summary.rowsAccepted,
      rows_rejected: params.preview.summary.rowsRejected,
      rows_with_warnings: params.preview.summary.rowsWithWarnings,
      preview_only: false,
      created_missing_submissions: params.preview.summary.createdSyntheticSubmissions,
      matched_existing_submissions: params.preview.summary.matchedExistingSubmissions,
      batch_size: batchSize,
      batch_count: Math.max(1, Math.ceil(acceptedRows.length / batchSize)),
      temp_image_paths: tempImagePaths,
      rubric_columns_present: hasRubricColumns,
    };

    const { error: importInsertError } = await params.supabaseAdmin.from("grade_imports").insert({
      id: importId,
      institution_id: params.institutionId,
      imported_by: params.userId,
      import_method: params.request.importMethod,
      file_path: sourceFilePath,
      rows_processed: params.preview.summary.rowsProcessed,
      rows_accepted: params.preview.summary.rowsAccepted,
      source_metadata: importMetadata,
    });

    if (importInsertError) {
      logError("import-grades import log insert failed", importInsertError, {
        assignmentId: params.assignmentId,
        importId,
      });
      throw new Error("Failed to create the import audit record");
    }

    const submissionRowsToCreate = acceptedRows.filter((row) => row.submissionAction === "create");
    for (const row of submissionRowsToCreate) {
      const submissionInsert = await params.supabaseAdmin.from("submissions").insert({
        institution_id: params.institutionId,
        assignment_id: params.assignmentId,
        student_name: row.studentName || null,
        student_email: row.studentEmail,
        file_name: `Imported grade ${row.rowNumber}`,
        file_url: buildSyntheticSubmissionFileUrl(importId, row.rowNumber),
        file_type: "import",
        status: "approved",
        submitted_at: row.submissionDate || new Date().toISOString(),
        uploaded_by: params.userId,
      }).select("id");

      if (submissionInsert.error || !submissionInsert.data?.[0]?.id) {
        throw new Error(submissionInsert.error?.message || "Failed to create an imported submission record");
      }
      row.matchedSubmissionId = submissionInsert.data[0].id;
    }

    const submissionIds = acceptedRows
      .map((row) => row.matchedSubmissionId)
      .filter((value): value is string => Boolean(value));

    const existingGradesBySubmission = await loadExistingGrades(params.supabaseAdmin, submissionIds, params.institutionId);
    const acceptedBatches = chunkArray(acceptedRows, batchSize);

    for (const [batchIndex, batch] of acceptedBatches.entries()) {
      logInfo("import-grades batch started", {
        function: "import-grades",
        assignmentId: params.assignmentId,
        importId,
        batchIndex: batchIndex + 1,
        batchCount: acceptedBatches.length,
        batchSize: batch.length,
      });

      await Promise.all(batch.map(async (row) => {
        const submissionId = row.matchedSubmissionId;
        if (!submissionId) {
          throw new Error(`Missing submission linkage for row ${row.rowNumber}`);
        }

        const existingGrade = existingGradesBySubmission.get(submissionId) ?? null;
        const payload = buildImportedGradePayload({
          importId,
          row,
          submissionId,
          lecturerId: params.userId,
          institutionId: params.institutionId,
          sourceFileName,
          sourceFileHash,
          importMethod: params.request.importMethod,
          existingGrade,
        });

        const { error: gradeUpsertError } = await params.supabaseAdmin.from("grades").upsert(
          {
            ...payload,
            submission_id: submissionId,
          },
          { onConflict: "submission_id" },
        );

        if (gradeUpsertError) {
          throw new Error(gradeUpsertError.message || "Failed to save an imported grade");
        }

        const { error: submissionUpdateError } = await params.supabaseAdmin
          .from("submissions")
          .update({
            status: "approved",
            student_name: row.studentName || null,
            student_email: row.studentEmail,
          })
          .eq("id", submissionId)
          .eq("institution_id", params.institutionId);

        if (submissionUpdateError) {
          logWarn("import-grades submission update failed", {
            assignmentId: params.assignmentId,
            importId,
            submissionId,
            error: submissionUpdateError,
          });
        }
      }));

      logInfo("import-grades batch completed", {
        function: "import-grades",
        assignmentId: params.assignmentId,
        importId,
        batchIndex: batchIndex + 1,
        batchCount: acceptedBatches.length,
        batchSize: batch.length,
      });
    }

    const { error: importUpdateError } = await params.supabaseAdmin
      .from("grade_imports")
      .update({
        rows_processed: params.preview.summary.rowsProcessed,
        rows_accepted: params.preview.summary.rowsAccepted,
        source_metadata: {
          ...importMetadata,
          status: "completed",
          import_id: importId,
        },
      })
      .eq("id", importId)
      .eq("institution_id", params.institutionId);

    if (importUpdateError) {
      logWarn("import-grades import log update failed", {
        assignmentId: params.assignmentId,
        importId,
        error: importUpdateError,
      });
    }

    logInfo("import-grades completed", {
      function: "import-grades",
      assignmentId: params.assignmentId,
      importMethod: params.request.importMethod,
      rowsProcessed: params.preview.summary.rowsProcessed,
      rowsAccepted: params.preview.summary.rowsAccepted,
      rowsRejected: params.preview.summary.rowsRejected,
      createdSyntheticSubmissions: params.preview.summary.createdSyntheticSubmissions,
    });

    return new Response(JSON.stringify({
      success: true,
      committed: true,
      importId,
      assignmentId: params.assignmentId,
      importMethod: params.request.importMethod,
      summary: params.preview.summary,
      rows: params.preview.rows,
    }), {
      headers: { ...params.corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    if (tempImagePaths.length > 0) {
      await removeTempImageFiles({ supabaseAdmin: params.supabaseAdmin, paths: tempImagePaths });
    }
  }
}
