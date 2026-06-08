// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  applySharedRateLimitMock,
  buildExistingGradesByFingerprintMock,
  createAdminClientMock,
  getCorsHeadersMock,
  gradeSingleSubmissionMock,
  loadAssignmentForGradingMock,
  loadAssignmentSubmissionRowsMock,
  loadExistingGradesForGradingMock,
  loadRequestedSubmissionsForGradingMock,
  parseGradeSubmissionRequestPayloadMock,
  recordGradingAuditEventMock,
  recordGradingErrorEventMock,
  recordGradingFailureAuditMock,
  recordGradingWorkflowRunMock,
  requireLecturerMock,
  resolveGradingPassesMock,
  normalizeSubmissionStoragePathMock,
  isSupportedSubmissionFileMock,
  getWorkflowRunGradingPassCountMock,
  fetchSubmissionContentMock,
  persistGradedSubmissionResultMock,
  getPassSpreadThresholdMock,
  getModelMock,
  classifyGradingErrorMock,
  createCorsForbiddenResponseMock,
  createRateLimitResponseMock,
  logErrorMock,
  logInfoMock,
  logWarnMock,
  jsonErrorMock,
  isDocumentExtractionErrorMock,
  buildGradingErrorEventPayloadMock,
} = vi.hoisted(() => ({
  applySharedRateLimitMock: vi.fn(),
  buildExistingGradesByFingerprintMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  getCorsHeadersMock: vi.fn(),
  gradeSingleSubmissionMock: vi.fn(),
  loadAssignmentForGradingMock: vi.fn(),
  loadAssignmentSubmissionRowsMock: vi.fn(),
  loadExistingGradesForGradingMock: vi.fn(),
  loadRequestedSubmissionsForGradingMock: vi.fn(),
  parseGradeSubmissionRequestPayloadMock: vi.fn(),
  recordGradingAuditEventMock: vi.fn(),
  recordGradingErrorEventMock: vi.fn(),
  recordGradingFailureAuditMock: vi.fn(),
  recordGradingWorkflowRunMock: vi.fn(),
  requireLecturerMock: vi.fn(),
  resolveGradingPassesMock: vi.fn(),
  normalizeSubmissionStoragePathMock: vi.fn(),
  isSupportedSubmissionFileMock: vi.fn(),
  getWorkflowRunGradingPassCountMock: vi.fn(),
  fetchSubmissionContentMock: vi.fn(),
  persistGradedSubmissionResultMock: vi.fn(),
  getPassSpreadThresholdMock: vi.fn(),
  getModelMock: vi.fn(),
  classifyGradingErrorMock: vi.fn(),
  createCorsForbiddenResponseMock: vi.fn(),
  createRateLimitResponseMock: vi.fn(),
  logErrorMock: vi.fn(),
  logInfoMock: vi.fn(),
  logWarnMock: vi.fn(),
  jsonErrorMock: vi.fn(),
  isDocumentExtractionErrorMock: vi.fn(),
  buildGradingErrorEventPayloadMock: vi.fn(),
}));

vi.mock("../../supabase/functions/_shared/auth.ts", () => {
  class HttpError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = "HttpError";
    }
  }

  return {
    createAdminClient: createAdminClientMock,
    jsonError: jsonErrorMock.mockImplementation((error: unknown) =>
      new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
        status: error instanceof HttpError ? error.status : 500,
        headers: { "Content-Type": "application/json" },
      })
    ),
    requireLecturer: requireLecturerMock,
    HttpError,
  };
});

vi.mock("../../supabase/functions/_shared/cors.ts", () => ({
  createCorsForbiddenResponse: createCorsForbiddenResponseMock.mockImplementation(
    () => new Response("forbidden", { status: 403 }),
  ),
  getCorsHeaders: getCorsHeadersMock,
}));

vi.mock("../../supabase/functions/_shared/log.ts", () => ({
  logError: logErrorMock,
  logInfo: logInfoMock,
  logWarn: logWarnMock,
}));

vi.mock("../../supabase/functions/_shared/openai.ts", () => ({
  getModel: getModelMock,
}));

vi.mock("../../supabase/functions/_shared/rate-limit.ts", () => ({
  applySharedRateLimit: applySharedRateLimitMock,
  createRateLimitResponse: createRateLimitResponseMock.mockImplementation(
    () => new Response(JSON.stringify({ error: "rate limited" }), { status: 429 }),
  ),
}));

vi.mock("../../supabase/functions/_shared/grade-submission-request.ts", () => ({
  parseGradeSubmissionRequestPayload: parseGradeSubmissionRequestPayloadMock,
}));

vi.mock("../../supabase/functions/grade-submission/error-telemetry.ts", () => ({
  buildGradingErrorEventPayload: buildGradingErrorEventPayloadMock,
  classifyGradingError: classifyGradingErrorMock,
}));

vi.mock("../../supabase/functions/grade-submission/grading-support.ts", () => ({
  isSupportedSubmissionFile: isSupportedSubmissionFileMock,
  normalizeSubmissionStoragePath: normalizeSubmissionStoragePathMock,
}));

vi.mock("../../supabase/functions/grade-submission/request-stage.ts", () => ({
  buildExistingGradesByFingerprint: buildExistingGradesByFingerprintMock,
  loadAssignmentForGrading: loadAssignmentForGradingMock,
  loadAssignmentSubmissionRows: loadAssignmentSubmissionRowsMock,
  loadExistingGradesForGrading: loadExistingGradesForGradingMock,
  loadRequestedSubmissionsForGrading: loadRequestedSubmissionsForGradingMock,
  normalizeRubricForAssignment: vi.fn(() => ({
    normalizedRubric: [{ criterion: "Analysis", weight: 100, description: "Analyse the work." }],
    rubricText: "- Analysis (100 pts): Analyse the work.",
  })),
}));

vi.mock("../../supabase/functions/grade-submission/submission-stage.ts", () => ({
  gradeSingleSubmission: gradeSingleSubmissionMock,
}));

vi.mock("../../supabase/functions/grade-submission/batch-support.ts", () => ({
  getConfiguredGradingPasses: vi.fn(() => 3),
  resolveGradingPasses: resolveGradingPassesMock,
  getPassSpreadThreshold: getPassSpreadThresholdMock,
  isDocumentExtractionError: isDocumentExtractionErrorMock,
  recordGradingFailureAudit: recordGradingFailureAuditMock,
  recordGradingErrorEvent: recordGradingErrorEventMock,
  recordGradingAuditEvent: recordGradingAuditEventMock,
  recordGradingWorkflowRun: recordGradingWorkflowRunMock,
  getWorkflowRunGradingPassCount: getWorkflowRunGradingPassCountMock,
  fetchSubmissionContent: fetchSubmissionContentMock,
  persistGradedSubmissionResult: persistGradedSubmissionResultMock,
}));

let serveHandler: ((req: Request) => Promise<Response>) | null = null;

vi.stubGlobal("Deno", {
  serve: (handler: (req: Request) => Promise<Response>) => {
    serveHandler = handler;
  },
  env: {
    get: vi.fn(),
  },
});

await import("../../supabase/functions/grade-submission/batch-coordinator.ts");

describe("grade-submission batch coordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getCorsHeadersMock.mockReturnValue({
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    });
    requireLecturerMock.mockResolvedValue({
      supabase: {
        from: vi.fn(() => {
          const chain = {
            select() {
              return chain;
            },
            eq() {
              return chain;
            },
            maybeSingle: async () => ({
              data: {
                id: "user-1",
                institution_id: "institution-1",
              },
              error: null,
            }),
          };

          return chain;
        }),
      },
      user: { id: "user-1" },
      roles: ["lecturer"],
    });
    applySharedRateLimitMock.mockResolvedValue({
      allowed: true,
      identifierType: "user",
    });
    parseGradeSubmissionRequestPayloadMock.mockReturnValue({
      success: true,
      data: {
        assignmentId: "assignment-1",
        submissionIds: ["submission-bad", "submission-good"],
        force_regenerate: false,
        grading_passes_override: undefined,
      },
    });
    getModelMock.mockReturnValue("gpt-test-model");
    resolveGradingPassesMock.mockReturnValue(3);
    getPassSpreadThresholdMock.mockReturnValue(8);
    getWorkflowRunGradingPassCountMock.mockImplementation((gradingPasses: number) => Math.max(1, Math.trunc(gradingPasses)));
    normalizeSubmissionStoragePathMock.mockImplementation((value: string | null) => value ?? null);
    isSupportedSubmissionFileMock.mockReturnValue(true);
    isDocumentExtractionErrorMock.mockReturnValue(false);
    classifyGradingErrorMock.mockReturnValue({
      safeErrorCategory: "grading_failure",
      errorCode: "grading_failed",
    });
    buildGradingErrorEventPayloadMock.mockImplementation((payload: Record<string, unknown>) => payload);
    createAdminClientMock.mockReturnValue({});
    loadAssignmentForGradingMock.mockResolvedValue({
      data: {
        id: "assignment-1",
        lecturer_id: "lecturer-1",
        institution_id: "institution-1",
        title: "Case Study",
        description: "Analyse the submission.",
        module_code: "CS101",
        max_score: 100,
        rubric: [{ criterion: "Analysis", weight: 100, description: "Analyse the work." }],
      },
      error: null,
    });
    loadRequestedSubmissionsForGradingMock.mockResolvedValue({
      data: [
        {
          id: "submission-bad",
          assignment_id: "assignment-1",
          institution_id: "institution-1",
          student_name: "Student Bad",
          student_email: "bad@example.com",
          file_name: "bad.pdf",
          file_url: null,
        },
        {
          id: "submission-good",
          assignment_id: "assignment-1",
          institution_id: "institution-1",
          student_name: "Student Good",
          student_email: "good@example.com",
          file_name: "good.pdf",
          file_url: "submissions/good.pdf",
        },
      ],
      error: null,
    });
    loadAssignmentSubmissionRowsMock.mockResolvedValue({
      data: [
        {
          id: "submission-bad",
          institution_id: "institution-1",
          file_url: null,
          file_name: "bad.pdf",
          student_name: "Student Bad",
          student_email: "bad@example.com",
        },
        {
          id: "submission-good",
          institution_id: "institution-1",
          file_url: "submissions/good.pdf",
          file_name: "good.pdf",
          student_name: "Student Good",
          student_email: "good@example.com",
        },
      ],
      error: null,
      assignmentSubmissionIds: ["submission-bad", "submission-good"],
      assignmentSubmissionsById: new Map([
        ["submission-bad", { file_url: null }],
        ["submission-good", { file_url: "submissions/good.pdf", file_name: "good.pdf", student_name: "Student Good", student_email: "good@example.com" }],
      ]),
    });
    loadExistingGradesForGradingMock.mockResolvedValue({
      data: [],
      error: null,
      existingGradesBySubmission: new Map(),
    });
    buildExistingGradesByFingerprintMock.mockResolvedValue(new Map());
    gradeSingleSubmissionMock.mockResolvedValue({
      success: true,
      submissionId: "submission-good",
      score: 84,
      feedback: "Strong analysis.",
      breakdown: [],
      assignmentType: "essay",
      gradingConfidence: 0.9,
      requiresLecturerReview: false,
      reviewReasons: [],
      gradingMetadata: { grading_input_hash: "hash-1" },
    });
    persistGradedSubmissionResultMock.mockResolvedValue(undefined);
    recordGradingFailureAuditMock.mockResolvedValue(undefined);
    recordGradingErrorEventMock.mockResolvedValue(undefined);
    recordGradingAuditEventMock.mockResolvedValue(undefined);
    recordGradingWorkflowRunMock.mockImplementation(async ({ phase }) => (phase === "running" ? "workflow-1" : null));
    fetchSubmissionContentMock.mockResolvedValue({
      extractedText: "Readable submission text",
      extractionMetadata: { extraction_success: true },
    });
  });

  it("returns a valid CORS response for preflight requests", async () => {
    expect(serveHandler).not.toBeNull();
    const response = await serveHandler!(
      new Request("https://gradeai.test/functions/v1/grade-submission", { method: "OPTIONS" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("processes mixed grading batches and keeps failures isolated to the affected submission", async () => {
    expect(serveHandler).not.toBeNull();
    const response = await serveHandler!(
      new Request("https://gradeai.test/functions/v1/grade-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: "assignment-1",
          submissionIds: ["submission-bad", "submission-good"],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.results).toHaveLength(2);
    expect(payload.results[0]).toEqual(
      expect.objectContaining({
        submissionId: "submission-bad",
        success: false,
        error: "Submission file URL is missing. Re-upload the document and try again.",
      }),
    );
    expect(payload.results[1]).toEqual(
      expect.objectContaining({
        submissionId: "submission-good",
        success: true,
        score: 84,
      }),
    );
    expect(recordGradingFailureAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: "submission-bad", assignmentId: "assignment-1" }),
    );
    expect(recordGradingAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: "submission-good", eventType: "grading_started" }),
    );
    expect(recordGradingWorkflowRunMock).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "running", status: "running" }),
    );
    expect(recordGradingWorkflowRunMock).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "terminal", status: "failed" }),
    );
  });
});
