import { createAdminClient, HttpError } from "../_shared/auth.ts";
import { createChatCompletion, getModel, parseJsonText } from "../_shared/openai.ts";
import { logWarn } from "../_shared/log.ts";
import {
  type GradeImportMethod,
  type GradeImportRubricItem,
  type GradeImportSourceRow,
} from "../_shared/grade-import.ts";
import {
  getTempImageRetentionDays,
  sanitizeFilePathSegment,
} from "./request.ts";

const DEFAULT_IMPORT_MODEL = "gpt-4o-mini";
const TEMP_IMAGE_BUCKET = "grade-import-temp";

function normalizeRubricItems(
  value: unknown,
  fallbackMaxScore: number,
): GradeImportRubricItem[] {
  const candidateRows = Array.isArray(value) ? value : [];
  return candidateRows.map((entry, index) => {
    const record = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const label = typeof record.label === "string"
      ? record.label
      : typeof record.name === "string"
        ? record.name
        : typeof record.criterion === "string"
          ? record.criterion
          : `Criterion ${index + 1}`;
    const scoreRaw = typeof record.score === "number" ? record.score : Number(record.score);
    const maxRaw = typeof record.max_score === "number" ? record.max_score : Number(record.max_score);
    const weightRaw = typeof record.weight === "number" ? record.weight : Number(record.weight);
    const maxScore = Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : fallbackMaxScore;
    const score = Number.isFinite(scoreRaw) ? scoreRaw : Number.NaN;
    const weight = Number.isFinite(weightRaw) && weightRaw >= 0 ? weightRaw : 1;
    const normalizedScore = Number.isFinite(score) && maxScore > 0 ? Math.round(((score / maxScore) * 100) * 100) / 100 : Number.NaN;

    return {
      key: typeof record.key === "string" && record.key.trim() ? record.key.trim() : `criterion_${index + 1}`,
      label: label.trim(),
      score,
      maxScore,
      weight,
      normalizedScore,
      raw: Object.fromEntries(
        Object.entries(record).map(([key, itemValue]) => [key, typeof itemValue === "string" ? itemValue : JSON.stringify(itemValue)]),
      ),
    };
  }).filter((item) => item.label.length > 0);
}

export async function uploadTempImageFiles(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  importId: string;
  files: File[];
}) {
  const uploadedPaths: string[] = [];
  try {
    for (const [index, file] of params.files.entries()) {
      if (!file.type.startsWith("image/")) {
        throw new HttpError(400, "Image imports only accept image files");
      }

      const fileName = `${index + 1}-${sanitizeFilePathSegment(file.name || "image")}`;
      const path = `grade-imports/${sanitizeFilePathSegment(params.importId)}/temp/${fileName}`;
      const { error } = await params.supabaseAdmin.storage.from(TEMP_IMAGE_BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
      if (error) {
        throw new Error(error.message || "Failed to upload a temporary image for processing");
      }
      uploadedPaths.push(path);
    }
    return uploadedPaths;
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await removeTempImageFiles({ supabaseAdmin: params.supabaseAdmin, paths: uploadedPaths });
    }
    throw error;
  }
}

export async function removeTempImageFiles(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  paths: string[];
}) {
  const uniquePaths = Array.from(new Set(params.paths.filter(Boolean)));
  if (uniquePaths.length === 0) return;
  const { error } = await params.supabaseAdmin.storage.from(TEMP_IMAGE_BUCKET).remove(uniquePaths);
  if (error) {
    logWarn("import-grades temp image cleanup failed", {
      bucket: TEMP_IMAGE_BUCKET,
      paths: uniquePaths.length,
      error,
    });
  }
}

export async function purgeExpiredTempImportArtifacts(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
) {
  const cutoff = new Date(Date.now() - getTempImageRetentionDays() * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("grade_imports")
    .select("id, file_path, source_metadata, created_at")
    .eq("import_method", "image")
    .lt("created_at", cutoff);

  if (error) {
    logWarn("import-grades stale temp cleanup query failed", { error });
    return;
  }

  const paths = new Set<string>();
  for (const row of data ?? []) {
    if (typeof row.file_path === "string" && row.file_path.trim()) {
      paths.add(row.file_path);
    }
    const sourceMetadata = row.source_metadata && typeof row.source_metadata === "object"
      ? row.source_metadata as Record<string, unknown>
      : null;
    const tempPaths = sourceMetadata && Array.isArray(sourceMetadata.temp_image_paths)
      ? sourceMetadata.temp_image_paths
      : [];
    for (const tempPath of tempPaths) {
      if (typeof tempPath === "string" && tempPath.trim()) {
        paths.add(tempPath);
      }
    }
  }

  if (paths.size === 0) return;
  const { error: cleanupError } = await supabaseAdmin.storage.from(TEMP_IMAGE_BUCKET).remove(Array.from(paths));
  if (cleanupError) {
    logWarn("import-grades stale temp cleanup failed", {
      bucket: TEMP_IMAGE_BUCKET,
      paths: paths.size,
      error: cleanupError,
    });
  }
}

function buildImageExtractionPrompt(maxScore: number) {
  return [
    "Extract the grade table from this image as JSON.",
    "Return a JSON object with a rows array.",
    "Each row must include student_name, student_email if visible, score, max_score, submission_date if visible, and notes if visible.",
    "If the image shows rubric columns or a per-criterion breakdown, include rubric_breakdown as an array of objects with key, label, score, max_score, and weight when visible.",
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
    const rubricBreakdown = normalizeRubricItems(
      row.rubric_breakdown ?? row.rubric ?? row.criteria ?? row.breakdown,
      Number.isFinite(maxScoreRaw) && maxScoreRaw > 0 ? maxScoreRaw : maxScore,
    );
    return {
      rowNumber: index + 1,
      studentName,
      studentEmail,
      score: Number.isFinite(scoreRaw) ? scoreRaw : Number.NaN,
      maxScore: Number.isFinite(maxScoreRaw) && maxScoreRaw > 0 ? maxScoreRaw : maxScore,
      submissionDate,
      notes,
      rubricBreakdown,
      raw: Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]),
      ),
    };
  });
}

export async function buildImageImportRows(params: {
  files: File[];
  assignmentMaxScore: number;
}) {
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
