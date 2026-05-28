import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { AssignmentDetailSubmission } from "@/pages/dashboard/assignment-detail/types";
import type { AIResponse, GradeBreakdown } from "@/types";

export interface GradeSubmissionResult {
  submissionId: string;
  success: boolean;
  score?: number | null;
  feedback?: string | null;
  breakdown?: GradeBreakdown[] | null;
  assignmentType?: string | null;
  gradingConfidence?: number | null;
  gradingMetadata?: Record<string, unknown> | null;
  requiresLecturerReview?: boolean;
  error?: string | null;
  aiResponse?: AIResponse | null;
}

export interface GradeSubmissionInvokeData {
  results?: GradeSubmissionResult[];
}

export const LARGE_COHORT_INTEGRITY_WARNING_THRESHOLD = 80;
export const LEGACY_INTEGRITY_REQUEST_COMPAT_LIMIT = 80;
export const INTEGRITY_RUNTIME_WARNING_THRESHOLD = 30;
export const GRADABLE_TEXT_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".txt",
  ".py",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".java",
  ".c",
  ".cpp",
  ".cc",
  ".cs",
  ".go",
  ".php",
  ".rb",
  ".rs",
  ".swift",
  ".kt",
  ".kts",
  ".scala",
  ".sql",
  ".html",
  ".css",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
  ".sh",
  ".md",
] as const;
export const GRADABLE_FILE_LABEL = "PDF, DOCX, TXT, or supported code file";
export const EXTRACTION_FAILURE_MESSAGE =
  "We could not extract reliable readable content from this document.";

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "AI grading failed";

export const asJson = (value: unknown): Json => value as Json;

export const hasGradableSubmissionFile = (submission: AssignmentDetailSubmission) => {
  const candidate = `${submission.file_name ?? ""} ${submission.file_url ?? ""}`.toLowerCase();
  return (
    Boolean(submission.file_url?.trim()) &&
    GRADABLE_TEXT_EXTENSIONS.some((extension) => candidate.includes(extension))
  );
};

export const isExtractionFailure = (message: string | null | undefined) =>
  typeof message === "string" && message.includes(EXTRACTION_FAILURE_MESSAGE);

export type LastGradingRunSummary = {
  attemptedCount: number;
  detail: string;
  extractionFailureCount: number;
  failedCount: number;
  headline: string;
  invalidResultCount: number;
  recoveryActions: string[];
  serviceFailureCount: number;
  skippedCount: number;
  successCount: number;
};

export type SubmissionGradingRecoveryIssue = {
  detail: string;
  headline: string;
  recoveryLabel: string;
  type: "missing_file" | "extraction_failure" | "invalid_result" | "service_failure";
};

export const isRetryableRecoveryType = (type: SubmissionGradingRecoveryIssue["type"]) => type !== "missing_file";

export const buildMissingFileRecoveryIssue = (): SubmissionGradingRecoveryIssue => ({
  headline: "Readable file needed",
  detail: `No readable ${GRADABLE_FILE_LABEL} was attached, so this submission was skipped before grading.`,
  recoveryLabel: "Needs re-upload",
  type: "missing_file",
});

export const buildExtractionFailureRecoveryIssue = (): SubmissionGradingRecoveryIssue => ({
  headline: "Readable file needed",
  detail:
    "GradeAI could not reliably extract text from this PDF. Continue with manual review or upload a DOCX copy while PDF support is being verified.",
  recoveryLabel: "Needs re-upload",
  type: "extraction_failure",
});

export const buildInvalidResultRecoveryIssue = (): SubmissionGradingRecoveryIssue => ({
  headline: "Incomplete grading result",
  detail: "The grading output could not be validated, so this submission stayed in its previous workflow state.",
  recoveryLabel: "Select for retry",
  type: "invalid_result",
});

export const buildMissingResultRecoveryIssue = (): SubmissionGradingRecoveryIssue => ({
  headline: "Incomplete grading result",
  detail:
    "The grading service returned no usable result for this submission. Retry the batch or continue with manual follow-up.",
  recoveryLabel: "Select for retry",
  type: "invalid_result",
});

export const buildServiceFailureRecoveryIssue = (
  detail = "The grading service did not complete cleanly for this submission.",
): SubmissionGradingRecoveryIssue => ({
  headline: "Retry AI grading",
  detail,
  recoveryLabel: "Select for retry",
  type: "service_failure",
});

export type GradePersistenceClient = {
  from: (table: "grades") => {
    upsert?: (
      values: {
        submission_id: string;
        ai_score: number | null;
        ai_feedback: string | null;
        ai_breakdown: Json;
        assignment_type: string | null;
        grading_confidence: number | null;
        grading_metadata: Json;
      },
      options: { onConflict: string },
    ) => Promise<{ error: { message?: string } | null }>;
  };
};

type PersistGradedSubmissionResultArgs = {
  gradingResult: GradeSubmissionResult;
  submissionId: string;
  supabaseClient?: GradePersistenceClient;
  validatedGrade: {
    ai_score: number | null;
    ai_feedback: string | null;
    ai_breakdown: GradeBreakdown[] | null;
    grading_confidence: number | null;
  };
};

export class GradePersistenceError extends Error {
  step: "client_configuration" | "grade_write";

  constructor(step: "client_configuration" | "grade_write", message: string) {
    super(message);
    this.name = "GradePersistenceError";
    this.step = step;
  }
}

export const persistGradedSubmissionResult = async ({
  gradingResult,
  submissionId,
  supabaseClient = supabase as unknown as GradePersistenceClient,
  validatedGrade,
}: PersistGradedSubmissionResultArgs) => {
  const gradesTable = supabaseClient.from("grades");

  if (!gradesTable.upsert) {
    throw new GradePersistenceError("client_configuration", "The grading persistence client is not configured correctly.");
  }

  const { error: gradeWriteError } = await gradesTable.upsert(
    {
      submission_id: submissionId,
      ai_score: validatedGrade.ai_score,
      ai_feedback: validatedGrade.ai_feedback,
      ai_breakdown: asJson(validatedGrade.ai_breakdown),
      assignment_type: gradingResult.assignmentType ?? null,
      grading_confidence: validatedGrade.grading_confidence ?? null,
      grading_metadata: asJson(gradingResult.gradingMetadata ?? {}),
    },
    { onConflict: "submission_id" },
  );

  if (gradeWriteError) {
    throw new GradePersistenceError("grade_write", gradeWriteError.message || "The AI grade could not be saved.");
  }
};

export const buildLastGradingRunSummary = ({
  attemptedCount,
  extractionFailureCount,
  failedCount,
  invalidResultCount,
  serviceFailureCount,
  skippedCount,
  successCount,
}: Omit<LastGradingRunSummary, "headline" | "detail" | "recoveryActions">): LastGradingRunSummary | null => {
  if (failedCount === 0 && skippedCount === 0) {
    return null;
  }

  const recoveryActions: string[] = [];
  const detailParts: string[] = [];

  if (skippedCount > 0) {
    detailParts.push(
      `${skippedCount} selected submission${skippedCount === 1 ? " was" : "s were"} skipped before grading because no readable ${GRADABLE_FILE_LABEL} was attached.`,
    );
    recoveryActions.push(`Ask the student to upload a readable ${GRADABLE_FILE_LABEL}.`);
  }

  if (extractionFailureCount > 0) {
    detailParts.push(
      `${extractionFailureCount} submission${extractionFailureCount === 1 ? "" : "s"} could not be read by the grading service.`,
    );
    recoveryActions.push("Retry AI grading after confirming the uploaded files open correctly.");
  }

  if (invalidResultCount > 0) {
    detailParts.push(
      `${invalidResultCount} grading result${invalidResultCount === 1 ? " was" : "s were"} incomplete and need manual follow-up.`,
    );
  }

  if (serviceFailureCount > 0) {
    detailParts.push(
      `${serviceFailureCount} submission${serviceFailureCount === 1 ? "" : "s"} failed because the grading service did not complete cleanly.`,
    );
    if (!recoveryActions.includes("Retry AI grading after confirming the uploaded files open correctly.")) {
      recoveryActions.push("Retry AI grading once the service is available again.");
    }
  }

  if (!recoveryActions.includes("Continue with manual review if the retry still fails so release work does not stall.")) {
    recoveryActions.push("Continue with manual review if the retry still fails so release work does not stall.");
  }

  return {
    attemptedCount,
    detail: detailParts.join(" "),
    extractionFailureCount,
    failedCount,
    headline:
      successCount > 0
        ? `${failedCount + skippedCount} of ${attemptedCount + skippedCount} selected submissions still need attention`
        : "Last grading run needs attention before the workflow can move on",
    invalidResultCount,
    recoveryActions,
    serviceFailureCount,
    skippedCount,
    successCount,
  };
};
