// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from "vitest";

const { extractSubmissionDocumentMock, logDocumentExtractionResultMock, logWarnMock, getEnvMock } = vi.hoisted(() => ({
  extractSubmissionDocumentMock: vi.fn(),
  logDocumentExtractionResultMock: vi.fn(),
  logWarnMock: vi.fn(),
  getEnvMock: vi.fn(),
}));

vi.mock("../../supabase/functions/_shared/document-extraction", () => ({
  DOCUMENT_EXTRACTION_ERROR_MESSAGE: "Document extraction failed before grading.",
  extractSubmissionDocument: extractSubmissionDocumentMock,
  logDocumentExtractionResult: logDocumentExtractionResultMock,
}));

vi.mock("../../supabase/functions/_shared/env.ts", () => ({
  getEnv: getEnvMock,
}));

vi.mock("../../supabase/functions/_shared/log.ts", () => ({
  logInfo: vi.fn(),
  logWarn: logWarnMock,
}));

import {
  ExtractionFailureError,
} from "../../supabase/functions/grade-submission/pdf-adequacy";
import {
  fetchSubmissionContent,
  getConfiguredGradingPasses,
  getPassSpreadThreshold,
  getWorkflowRunGradingPassCount,
  persistGradedSubmissionResult,
  recordGradingAuditEvent,
  recordGradingErrorEvent,
  recordGradingFailureAudit,
  recordGradingWorkflowRun,
  resolveGradingPasses,
} from "../../supabase/functions/grade-submission/batch-support";

function createSupabaseAdminMock(options?: {
  storageDownload?: { data: Blob | null; error: { message: string } | null };
  gradeUpsertError?: { message?: string } | null;
  submissionUpdateError?: { message?: string } | null;
  auditInsertError?: { message?: string } | null;
  workflowInsertError?: { message?: string } | null;
}) {
  const calls = {
    grades: [] as unknown[],
    submissions: [] as unknown[],
    gradeAudit: [] as unknown[],
    gradingErrors: [] as unknown[],
    workflowRuns: [] as unknown[],
  };
  const storageDownload = vi.fn(async () => options?.storageDownload ?? {
    data: new Blob(["Readable submission text"], { type: "application/pdf" }),
    error: null,
  });
  const gradesUpsert = vi.fn(async (payload: unknown) => {
    calls.grades.push(payload);
    return { error: options?.gradeUpsertError ?? null };
  });
  const submissionUpdateEq = vi.fn(async () => ({
    error: options?.submissionUpdateError ?? null,
  }));
  const submissionUpdateEq2 = vi.fn(() => ({
    eq: submissionUpdateEq,
  }));
  const submissionUpdate = vi.fn(() => ({
    eq: submissionUpdateEq2,
  }));
  const insertFactory = (collection: unknown[]) => vi.fn(async (payload: unknown) => {
    collection.push(payload);
    return { error: options?.auditInsertError ?? null };
  });

  return {
    calls,
    storage: {
      from: vi.fn(() => ({
        download: storageDownload,
      })),
    },
    from: vi.fn((table: string) => {
      if (table === "grades") {
        return { upsert: gradesUpsert };
      }
      if (table === "submissions") {
        return { update: submissionUpdate };
      }
      if (table === "grade_audit_log") {
        return { insert: insertFactory(calls.gradeAudit) };
      }
      if (table === "grading_error_events") {
        return { insert: insertFactory(calls.gradingErrors) };
      }
      if (table === "workflow_runs") {
        return { insert: vi.fn(async (payload: unknown) => {
          calls.workflowRuns.push(payload);
          return { error: options?.workflowInsertError ?? null };
        }) };
      }
      return {
        insert: insertFactory([]),
        upsert: gradesUpsert,
        update: submissionUpdate,
      };
    }),
  };
}

describe("grade-submission batch support", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEnvMock.mockImplementation((name: string) => (name === "OPENAI_GRADING_PASSES" ? "4" : undefined));
  });

  it("clamps grading pass settings and spread thresholds", () => {
    expect(getConfiguredGradingPasses()).toBe(4);
    expect(resolveGradingPasses(2)).toBe(2);
    expect(resolveGradingPasses(undefined)).toBe(4);
    expect(getPassSpreadThreshold(100)).toBe(8);
    expect(getWorkflowRunGradingPassCount(0)).toBe(1);

    getEnvMock.mockImplementation((name: string) => (name === "OPENAI_GRADING_PASSES" ? "12" : undefined));
    expect(getConfiguredGradingPasses()).toBe(5);
    expect(resolveGradingPasses(9)).toBe(5);
  });

  it("loads readable submission content and fails closed on extraction issues", async () => {
    const supabaseAdmin = createSupabaseAdminMock();
    extractSubmissionDocumentMock.mockResolvedValue({
      success: true,
      extractedText: "Readable submission text",
      fileName: "essay.pdf",
      fileType: "pdf",
      mimeType: "application/pdf",
      extractionMethod: "pdf",
      extractionFailureReason: null,
      extractedTextLength: 24,
      extractionWarning: null,
      extractionError: null,
      extractionQuality: {
        qualityScore: 100,
        wordCount: 3,
        readableSentenceCount: 1,
        suspiciousPdfArtifactCount: 0,
      },
    });

    await expect(
      fetchSubmissionContent(supabaseAdmin as never, {
        file_url: "submissions/essay.pdf",
        file_name: "essay.pdf",
      }),
    ).resolves.toEqual({
      extractedText: "Readable submission text",
      extractionMetadata: expect.objectContaining({
        file_name: "essay.pdf",
        file_type: "pdf",
        mime_type: "application/pdf",
        extraction_success: true,
        extraction_quality_word_count: 3,
      }),
    });
    expect(logDocumentExtractionResultMock).toHaveBeenCalledWith(
      "grade-submission",
      expect.objectContaining({ success: true }),
    );

    await expect(
      fetchSubmissionContent(supabaseAdmin as never, {
        file_url: "submissions/archive.zip",
        file_name: "archive.zip",
      }),
    ).rejects.toThrow("Submission file type is not supported");

    const missingFileClient = createSupabaseAdminMock({
      storageDownload: {
        data: null,
        error: { message: "404 not found" },
      },
    });
    await expect(
      fetchSubmissionContent(missingFileClient as never, {
        file_url: "submissions/missing.pdf",
        file_name: "missing.pdf",
      }),
    ).rejects.toThrow("Submission file could not be found in storage");

    extractSubmissionDocumentMock.mockResolvedValueOnce({
      success: false,
      extractedText: "",
      fileName: "essay.pdf",
      fileType: "pdf",
      mimeType: "application/pdf",
      extractionMethod: "pdf",
      extractionFailureReason: "unreadable_pdf",
      extractedTextLength: 0,
      extractionWarning: "Unreadable PDF text",
      extractionError: "Unreadable PDF text",
      extractionQuality: {
        qualityScore: 0,
        wordCount: 0,
        readableSentenceCount: 0,
        suspiciousPdfArtifactCount: 5,
      },
    });
    const failingExtraction = fetchSubmissionContent(supabaseAdmin as never, {
      file_url: "submissions/essay.pdf",
      file_name: "essay.pdf",
    });
    await expect(failingExtraction).rejects.toBeInstanceOf(ExtractionFailureError);
    await expect(failingExtraction).rejects.toThrow("Unreadable PDF text");
    await expect(failingExtraction).rejects.toMatchObject({
      errorCode: "extraction_quality_failed",
    });
  });

  it("persists grades and records workflow telemetry payloads", async () => {
    const supabaseAdmin = createSupabaseAdminMock({
      submissionUpdateError: { message: "status update failed" },
      workflowInsertError: { message: "workflow insert failed" },
    });

    await persistGradedSubmissionResult({
      supabaseAdmin: supabaseAdmin as never,
      submissionId: "submission-1",
      institutionId: "institution-1",
      gradingResult: {
        score: 72,
        feedback: "Solid analysis.",
        breakdown: [{ criterion: "Analysis", score: 20 }],
        assignmentType: "essay",
        gradingConfidence: 0.82,
        gradingMetadata: { grading_input_hash: "hash-1" },
        requiresLecturerReview: true,
      },
    });

    expect(supabaseAdmin.calls.grades).toHaveLength(1);
    expect(supabaseAdmin.calls.grades[0]).toEqual(
      expect.objectContaining({
        submission_id: "submission-1",
        institution_id: "institution-1",
        ai_score: 72,
        grading_metadata: { grading_input_hash: "hash-1" },
      }),
    );
    expect(logWarnMock).toHaveBeenCalledWith(
      "grade-submission status update failed after grade save",
      expect.objectContaining({ submissionId: "submission-1", nextStatus: "first_review" }),
    );

    await recordGradingFailureAudit({
      supabaseAdmin: supabaseAdmin as never,
      submissionId: "submission-1",
      userId: "user-1",
      institutionId: "institution-1",
      actorRole: "lecturer",
      assignmentId: "assignment-1",
      reason: "Missing file URL",
      gradingModel: "gpt-4o-mini",
      forceRegenerate: false,
    });
    await recordGradingErrorEvent({
      supabaseAdmin: supabaseAdmin as never,
      submissionId: "submission-1",
      assignmentId: "assignment-1",
      userId: "user-1",
      institutionId: "institution-1",
      provider: "openai",
      reason: "OpenAI grading request timed out after 60000ms. Retry the submission or try again later.",
    });
    await recordGradingAuditEvent({
      supabaseAdmin: supabaseAdmin as never,
      submissionId: "submission-1",
      userId: "user-1",
      institutionId: "institution-1",
      actorRole: "lecturer",
      gradeId: "grade-1",
      moderationCaseId: "moderation-1",
      eventType: "grading_completed",
      previousValues: { status: "ai_grading" },
      newValues: { status: "ai_graded" },
      reason: "Completed.",
    });

    expect(supabaseAdmin.calls.gradeAudit).toHaveLength(2);
    expect(supabaseAdmin.calls.gradingErrors).toHaveLength(1);
    expect(supabaseAdmin.calls.gradeAudit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          submission_id: "submission-1",
          institution_id: "institution-1",
          changed_by: "user-1",
          event_type: "grading_failed",
        }),
        expect.objectContaining({
          submission_id: "submission-1",
          institution_id: "institution-1",
          changed_by: "user-1",
          event_type: "grading_completed",
        }),
      ]),
    );
    expect(supabaseAdmin.calls.gradingErrors[0]).toEqual(
      expect.objectContaining({
        submission_id: "submission-1",
        assignment_id: "assignment-1",
        institution_id: "institution-1",
        provider: "openai",
      }),
    );

    const workflowRunId = await recordGradingWorkflowRun({
      supabaseAdmin: supabaseAdmin as never,
      workflowRunId: "workflow-1",
      phase: "terminal",
      assignmentId: "assignment-1",
      submissionId: "submission-1",
      institutionId: "institution-1",
      triggeredBy: "user-1",
      model: "gpt-4o-mini",
      status: "failed",
      providerRetryCount: 1,
      gradingPassCount: 2,
      failureCategory: "grading_failure",
      startedAt: "2026-06-08T10:00:00.000Z",
      finishedAt: "2026-06-08T10:01:00.000Z",
      durationMs: 60_000,
      submissionCount: 1,
    });

    expect(workflowRunId).toBeNull();
    expect(supabaseAdmin.calls.workflowRuns).toHaveLength(1);
    expect(supabaseAdmin.calls.workflowRuns[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        workflow_name: "grade-submission",
        status: "failed",
        details: expect.objectContaining({
          workflow_run_phase: "terminal",
          parent_workflow_run_id: "workflow-1",
        }),
      }),
    );
    expect(logWarnMock).toHaveBeenCalledWith(
      "grade-submission workflow run telemetry insert failed",
      expect.objectContaining({ assignmentId: "assignment-1" }),
    );
  });
});
