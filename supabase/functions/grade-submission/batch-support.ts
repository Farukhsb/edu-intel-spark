import { createAdminClient, jsonError, requireLecturer, HttpError } from "../_shared/auth.ts";
import { getEnv } from "../_shared/env.ts";
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
import { ExtractionFailureError, buildExtractionFailureTelemetry } from "./pdf-adequacy.ts";
import type { FetchSubmissionContentForGrading } from "./types.ts";
const CONFIDENCE_THRESHOLD = 0.7;
const DEFAULT_GRADING_PASSES = 3;
const MAX_GRADING_PASSES = 5;
const PASS_SPREAD_REVIEW_THRESHOLD_RATIO = 0.08;
const PASS_SPREAD_REVIEW_THRESHOLD_MIN = 8;
const EXTRACTION_FAILURE_TELEMETRY_MESSAGE = "Document extraction failed before grading.";
const EXTRACTION_QUALITY_FAILURE_TELEMETRY_MESSAGE = "Extracted document text was not reliable enough for grading.";
export function getConfiguredGradingPasses() {
  const configured = Number(getEnv("OPENAI_GRADING_PASSES") || DEFAULT_GRADING_PASSES);
  if (!Number.isFinite(configured)) return DEFAULT_GRADING_PASSES;
  const normalized = Math.trunc(configured);
  if (normalized < 1) return 1;
  return Math.min(normalized, MAX_GRADING_PASSES);
}
export function resolveGradingPasses(override: number | undefined) {
  const configuredPasses = getConfiguredGradingPasses();
  if (override === undefined) {
    return configuredPasses;
  }
  return Math.min(configuredPasses, override);
}
export function getPassSpreadThreshold(maxScore: number) {
  return Math.max(PASS_SPREAD_REVIEW_THRESHOLD_MIN, Math.round(maxScore * PASS_SPREAD_REVIEW_THRESHOLD_RATIO));
}
export async function recordGradingFailureAudit({
  supabaseAdmin,
  submissionId,
  userId,
  institutionId,
  actorRole,
  assignmentId,
  reason,
  gradingModel,
  forceRegenerate,
}: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  submissionId: string;
  userId: string;
  institutionId: string;
  actorRole: "admin" | "lecturer";
  assignmentId: string;
  reason: string;
  gradingModel: string;
  forceRegenerate: boolean;
}) {
  const { error } = await supabaseAdmin.from("grade_audit_log").insert({
    submission_id: submissionId,
    institution_id: institutionId,
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
export async function recordGradingErrorEvent({
  supabaseAdmin,
  submissionId,
  assignmentId,
  userId,
  institutionId,
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
  institutionId: string;
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
      institutionId,
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
export async function recordGradingAuditEvent({
  supabaseAdmin,
  submissionId,
  userId,
  institutionId,
  actorRole,
  gradeId,
  moderationCaseId,
  eventType,
  previousValues,
  newValues,
  reason,
}: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  submissionId: string;
  userId: string;
  institutionId: string;
  actorRole: "admin" | "lecturer";
  gradeId?: string | null;
  moderationCaseId?: string | null;
  eventType: string;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason: string;
}) {
  const { error } = await supabaseAdmin.from("grade_audit_log").insert({
    submission_id: submissionId,
    grade_id: gradeId ?? null,
    moderation_case_id: moderationCaseId ?? null,
    institution_id: institutionId,
    changed_by: userId,
    event_type: eventType,
    actor_role: actorRole,
    previous_values: previousValues ?? {},
    new_values: newValues ?? {},
    reason,
  });
  if (error) {
    logWarn("grade-submission audit insert failed", {
      submissionId,
      eventType,
      error,
    });
  }
}
type WorkflowRunTelemetryStatus = "running" | "succeeded" | "failed";
export async function recordGradingWorkflowRun({
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
export function getWorkflowRunGradingPassCount(gradingPasses: number) {
  return Math.max(1, Math.trunc(gradingPasses));
}
export async function fetchSubmissionContent(
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
export async function persistGradedSubmissionResult({
  supabaseAdmin,
  submissionId,
  institutionId,
  gradingResult,
}: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  submissionId: string;
  institutionId: string;
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
      institution_id: institutionId,
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
    .eq("id", submissionId)
    .eq("institution_id", institutionId);
  if (submissionWriteError) {
    logWarn("grade-submission status update failed after grade save", {
      submissionId,
      nextStatus,
      error: submissionWriteError,
    });
  }
}
