import { supabase } from "@/integrations/supabase/client";
import {
  type DraftCommunicationMessage,
  queueCommunicationMessage,
} from "@/lib/communications";
import { log } from "@/lib/logger";

const ALLOWED_SUBMISSION_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/x-python",
  "text/x-java-source",
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
  "text/typescript",
  "application/typescript",
  "text/x-c",
  "text/x-c++src",
  "text/x-csharp",
  "text/x-perl",
  "text/x-pascal",
  "text/x-haskell",
  "text/x-verilog",
  "text/x-vhdl",
  "application/octet-stream",
]);

const ALLOWED_SUBMISSION_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".txt",
  ".py",
  ".java",
  ".js",
  ".ts",
  ".c",
  ".cpp",
  ".cs",
  ".pl",
  ".pas",
  ".hs",
  ".v",
  ".vhd",
]);

export const SUBMISSION_FILE_ACCEPT = Array.from(ALLOWED_SUBMISSION_EXTENSIONS).join(",");

export interface TargetedStudentProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  cohort_id: string | null;
  department_id: string | null;
}

export const normalizeStudentKey = (value: string | null | undefined) =>
  (value || "")
    .toLowerCase()
    .trim()
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

export const isAllowedSubmissionUpload = (file: File) => {
  const normalizedType = file.type.trim().toLowerCase();
  const normalizedName = file.name.trim().toLowerCase();
  return ALLOWED_SUBMISSION_TYPES.has(normalizedType) ||
    Array.from(ALLOWED_SUBMISSION_EXTENSIONS).some((extension) => normalizedName.endsWith(extension));
};

export const getSubmissionUploadFailureReason = (error: unknown) => {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
        ? error.message
        : "";

  const normalized = rawMessage.trim();
  if (!normalized) return null;

  if (normalized.length > 160) {
    return `${normalized.slice(0, 157)}...`;
  }

  return normalized;
};

export const loadTargetedStudentProfiles = async (assignmentId: string) => {
  const [cohortResult, departmentResult] = await Promise.all([
    supabase
      .from("assignment_cohorts")
      .select("cohort_id")
      .eq("assignment_id", assignmentId),
    supabase
      .from("assignment_departments")
      .select("department_id")
      .eq("assignment_id", assignmentId),
  ]);

  if (cohortResult.error) throw cohortResult.error;
  if (departmentResult.error) throw departmentResult.error;

  const cohortIds = Array.from(
    new Set((cohortResult.data || []).map((row) => row.cohort_id).filter(Boolean)),
  );
  const departmentIds = Array.from(
    new Set((departmentResult.data || []).map((row) => row.department_id).filter(Boolean)),
  );

  if (cohortIds.length === 0 && departmentIds.length === 0) {
    return [];
  }

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, role, cohort_id, department_id")
    .eq("role", "student");

  if (cohortIds.length > 0 && departmentIds.length > 0) {
    query = query.or(
      `cohort_id.in.(${cohortIds.join(",")}),department_id.in.(${departmentIds.join(",")})`,
    );
  } else if (cohortIds.length > 0) {
    query = query.in("cohort_id", cohortIds);
  } else {
    query = query.in("department_id", departmentIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as TargetedStudentProfile[];
};

export const persistWorkflowNotification = async (
  message: DraftCommunicationMessage,
  context: {
    assignmentId: string;
    workflow: "submission" | "ai-grading" | "integrity-check" | "grade-release";
  },
) => {
  try {
    const result = await queueCommunicationMessage(message);
    if (!result) {
      log.warn("Workflow notification did not persist", {
        assignmentId: context.assignmentId,
        workflow: context.workflow,
        category: message.category,
        recipientId: message.recipientId ?? null,
      });
    }
  } catch (error) {
    log.error("Workflow notification failed", error, {
      assignmentId: context.assignmentId,
      workflow: context.workflow,
      category: message.category,
      recipientId: message.recipientId ?? null,
    });
  }
};

export const uploadSubmissionFile = async (
  file: File,
  userId: string,
  assignmentId: string,
  onProgress?: (value: number) => void,
) => {
  if (!isAllowedSubmissionUpload(file)) {
    throw new Error("Unsupported file type");
  }

  const safeFileName = file.name.replace(/[\\/]/g, "_");
  const filePath = `${userId}/${assignmentId}/${Date.now()}_${safeFileName}`;

  onProgress?.(10);
  const { data, error } = await supabase.storage
    .from("submissions")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });
  if (error) throw error;
  onProgress?.(100);

  return {
    fileUrl: data.path,
    fileName: safeFileName,
    fileType: file.type || "application/octet-stream",
    storagePath: data.path,
  };
};
