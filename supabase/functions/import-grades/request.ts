import { getEnv, HttpError } from "../_shared/auth.ts";
import { parseImportScope, parseNewAssignment } from "./assignment.ts";

export type ParsedImportRequest = {
  assignmentId: string | null;
  importScope: "existing_assignment" | "new_assignment";
  confirm: boolean;
  importMethod: "csv" | "image";
  createMissingSubmissions: boolean;
  csvText: string | null;
  files: File[];
  sourceFileName: string | null;
  newAssignment: {
    title: string;
    moduleCode: string;
    maxScore: number;
    dueDate: string | null;
    description: string | null;
  } | null;
};

const HYBRID_IMPORT_ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);
const DEFAULT_IMPORT_BATCH_SIZE = 50;
const DEFAULT_TEMP_IMAGE_RETENTION_DAYS = 7;

export function isHybridImportEnabled() {
  const value = getEnv("HYBRID_IMPORT_ENABLED");
  if (!value || value.trim() === "") return true;
  return HYBRID_IMPORT_ENABLED_VALUES.has(value.trim().toLowerCase());
}

export function parseBoolean(value: FormDataEntryValue | null | undefined, defaultValue = false) {
  if (typeof value !== "string") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  return HYBRID_IMPORT_ENABLED_VALUES.has(normalized);
}

export function sanitizeFilePathSegment(value: string) {
  return value
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "import";
}

export function chunkArray<T>(items: T[], size: number) {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function getImportBatchSize() {
  const raw = getEnv("HYBRID_IMPORT_BATCH_SIZE");
  const parsed = raw ? Number(raw) : DEFAULT_IMPORT_BATCH_SIZE;
  if (!Number.isFinite(parsed)) return DEFAULT_IMPORT_BATCH_SIZE;
  return Math.max(1, Math.min(250, Math.trunc(parsed)));
}

export function getTempImageRetentionDays() {
  const raw = getEnv("HYBRID_IMPORT_TEMP_RETENTION_DAYS");
  const parsed = raw ? Number(raw) : DEFAULT_TEMP_IMAGE_RETENTION_DAYS;
  if (!Number.isFinite(parsed)) return DEFAULT_TEMP_IMAGE_RETENTION_DAYS;
  return Math.max(1, Math.min(90, Math.trunc(parsed)));
}

function guessImportMethod(files: File[], explicit: string | null) {
  if (explicit === "csv" || explicit === "image") {
    return explicit;
  }

  if (files.length === 0) return "csv";
  if (files.every((file) => file.type.startsWith("image/"))) return "image";
  return "csv";
}

export async function readImportRequest(req: Request): Promise<ParsedImportRequest> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const files = formData
      .getAll("file")
      .filter((value): value is File => value instanceof File);
    const assignmentId = String(formData.get("assignmentId") ?? formData.get("assignment_id") ?? "").trim();
    const explicitMethod = String(formData.get("importMethod") ?? formData.get("import_method") ?? "").trim().toLowerCase();
    const importScope = parseImportScope(formData.get("importScope") ?? formData.get("import_scope"));
    const csvTextValue = formData.get("csvText") ?? formData.get("csv_text");

    return {
      assignmentId: assignmentId || null,
      importScope,
      confirm: parseBoolean(formData.get("confirm"), false),
      importMethod: guessImportMethod(files, explicitMethod),
      createMissingSubmissions: parseBoolean(formData.get("createMissingSubmissions") ?? formData.get("create_missing_submissions"), true),
      csvText: typeof csvTextValue === "string" && csvTextValue.trim() ? csvTextValue : null,
      files,
      sourceFileName: files[0]?.name ?? null,
      newAssignment: parseNewAssignment({
        title: formData.get("newAssignmentTitle") ?? formData.get("new_assignment_title"),
        moduleCode: formData.get("newAssignmentModuleCode") ?? formData.get("new_assignment_module_code"),
        maxScore: formData.get("newAssignmentMaxScore") ?? formData.get("new_assignment_max_score"),
        dueDate: formData.get("newAssignmentDueDate") ?? formData.get("new_assignment_due_date"),
        description: formData.get("newAssignmentDescription") ?? formData.get("new_assignment_description"),
      }),
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
  const importScope = parseImportScope(raw.importScope ?? raw.import_scope);
  const csvText = typeof raw.csvText === "string"
    ? raw.csvText
    : typeof raw.csv_text === "string"
      ? raw.csv_text
      : null;

  return {
    assignmentId: assignmentId || null,
    importScope,
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
    newAssignment: parseNewAssignment({
      title: raw.newAssignmentTitle ?? raw.new_assignment_title,
      moduleCode: raw.newAssignmentModuleCode ?? raw.new_assignment_module_code,
      maxScore: raw.newAssignmentMaxScore ?? raw.new_assignment_max_score,
      dueDate: raw.newAssignmentDueDate ?? raw.new_assignment_due_date,
      description: raw.newAssignmentDescription ?? raw.new_assignment_description,
    }),
  };
}
