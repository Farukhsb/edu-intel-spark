// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../supabase/functions/_shared/document-extraction", () => ({
  DOCUMENT_EXTRACTION_ERROR_MESSAGE: "Document extraction failed",
  extractSubmissionDocument: async (params: { fileName?: string | null; mimeType?: string | null; fileData: Blob }) => {
    const extractedText = await params.fileData.text();
    const mimeType = params.mimeType ?? "text/plain";

    return {
      fileName: params.fileName ?? null,
      fileType: mimeType.includes("pdf") ? "pdf" : "txt",
      mimeType,
      extractedText,
      extractedTextLength: extractedText.length,
      success: true,
      extractionWarning: null,
      extractionError: null,
    };
  },
  logDocumentExtractionResult: vi.fn(),
}));

vi.mock("../../supabase/functions/_shared/text-analysis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../supabase/functions/_shared/text-analysis")>();

  return {
    ...actual,
    assessExtractionQuality: (text: string) => {
      if (text.includes("[LOW_QUALITY_FIXTURE]")) {
        return {
          isUsable: false,
          wordCount: 42,
          artifactRatio: 0.2,
          qualityScore: 15,
          reasons: ["Low-quality OCR text."],
        };
      }

      return actual.assessExtractionQuality(text);
    },
  };
});

import { resetRateLimitStore } from "../../supabase/functions/_shared/rate-limit";
import { createCheckPlagiarismHandler } from "../../supabase/functions/check-plagiarism/handler";

const repeatedEssay =
  "The capstone report analyses quaternion telemetry drift, lattice calibration error, and asynchronous checksum recovery " +
  "across a simulated robotics pipeline. It explains how phase-offset logs, sparse sensor harmonics, and packet jitter " +
  "combine to distort downstream control decisions when the recovery routine is misconfigured. The submission also " +
  "proposes a deterministic remediation sequence with staged validation, anomaly tagging, and rollback checkpoints for " +
  "each fault class in the experiment. A second section quantifies actuator divergence, replica cache invalidation, " +
  "boundary-condition leakage, and delayed semaphore release under repeated replay conditions. It then maps those " +
  "failures to a controlled mitigation plan covering observability probes, reconciliation checkpoints, and post-incident " +
  "verification tasks so the remediation logic can be audited with precise technical evidence. ";

const ids = {
  assignment: "11111111-1111-4111-8111-111111111111",
  lecturer: "22222222-2222-4222-8222-222222222222",
  studentB: "33333333-3333-4333-8333-333333333333",
  studentC: "44444444-4444-4444-8444-444444444444",
  submissionB: "55555555-5555-4555-8555-555555555555",
  submissionC: "66666666-6666-4666-8666-666666666666",
};

function buildGeneratedSubmissionId(index: number) {
  return `77777777-7777-4777-8777-${String(index).padStart(12, "0")}`;
}

function buildLargeCohortRows(count: number) {
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) {
      return {
        id: ids.submissionC,
        assignment_id: ids.assignment,
        student_id: ids.studentC,
        student_name: "Student C",
        student_email: "c@example.com",
        file_name: "c.txt",
        file_url: "submission-c.txt",
      };
    }

    const submissionIndex = index + 1;
    return {
      id: buildGeneratedSubmissionId(submissionIndex),
      assignment_id: ids.assignment,
      student_id: `88888888-8888-4888-8888-${String(submissionIndex).padStart(12, "0")}`,
      student_name: `Student ${submissionIndex}`,
      student_email: `student${submissionIndex}@example.com`,
      file_name: `submission-${submissionIndex}.txt`,
      file_url: `submission-${submissionIndex}.txt`,
    };
  });
}

function createUserSupabaseMock() {
  return {
    from(table: string) {
      if (table === "assignments") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: ids.assignment,
                  lecturer_id: ids.lecturer,
                  title: "Essay 1",
                  description: "Compare integrity signals",
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "submissions") {
        return {
          select: () => ({
            eq: () => {
              const assignmentWideResult: Promise<{ data: Array<Record<string, string>>; error: null }> = Promise.resolve({
                data: [
                  {
                    id: ids.submissionB,
                    assignment_id: ids.assignment,
                    student_id: ids.studentB,
                    student_name: "Student B",
                    student_email: "b@example.com",
                    file_name: "b.txt",
                    file_url: "submission-b.txt",
                  },
                  {
                    id: ids.submissionC,
                    assignment_id: ids.assignment,
                    student_id: ids.studentC,
                    student_name: "Student C",
                    student_email: "c@example.com",
                    file_name: "c.txt",
                    file_url: "submission-c.txt",
                  },
                ],
                error: null,
              });

              (assignmentWideResult as Promise<{ data: Array<Record<string, string>>; error: null }> & {
                in: () => Promise<{ data: Array<Record<string, string>>; error: null }>;
              }).in = async () => ({
                data: [
                  {
                    id: ids.submissionC,
                    assignment_id: ids.assignment,
                    student_id: ids.studentC,
                    student_name: "Student C",
                    student_email: "c@example.com",
                    file_name: "c.txt",
                    file_url: "submission-c.txt",
                  },
                ],
                error: null,
              });

              return assignmentWideResult as Promise<{ data: Array<Record<string, string>>; error: null }> & {
                in: () => Promise<{ data: Array<Record<string, string>>; error: null }>;
              };
            },
          }),
        };
      }

      throw new Error(`Unexpected user table ${table}`);
    },
  };
}

function createCodeUserSupabaseMock() {
  return {
    from(table: string) {
      if (table === "assignments") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: ids.assignment,
                  lecturer_id: ids.lecturer,
                  title: "Essay 1",
                  description: "Compare integrity signals",
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "submissions") {
        return {
          select: () => ({
            eq: () => {
              const assignmentWideResult: Promise<{ data: Array<Record<string, string>>; error: null }> = Promise.resolve({
                data: [
                  {
                    id: ids.submissionB,
                    assignment_id: ids.assignment,
                    student_id: ids.studentB,
                    student_name: "Student B",
                    student_email: "b@example.com",
                    file_name: "b.py",
                    file_url: "submission-b.py",
                  },
                  {
                    id: ids.submissionC,
                    assignment_id: ids.assignment,
                    student_id: ids.studentC,
                    student_name: "Student C",
                    student_email: "c@example.com",
                    file_name: "c.py",
                    file_url: "submission-c.py",
                  },
                ],
                error: null,
              });

              (assignmentWideResult as Promise<{ data: Array<Record<string, string>>; error: null }> & {
                in: () => Promise<{ data: Array<Record<string, string>>; error: null }>;
              }).in = async () => ({
                data: [
                  {
                    id: ids.submissionC,
                    assignment_id: ids.assignment,
                    student_id: ids.studentC,
                    student_name: "Student C",
                    student_email: "c@example.com",
                    file_name: "c.py",
                    file_url: "submission-c.py",
                  },
                ],
                error: null,
              });

              return assignmentWideResult as Promise<{ data: Array<Record<string, string>>; error: null }> & {
                in: () => Promise<{ data: Array<Record<string, string>>; error: null }>;
              };
            },
          }),
        };
      }

      throw new Error(`Unexpected user table ${table}`);
    },
  };
}

function createUserSupabaseMockWithAssignmentWideFailure() {
  let submissionsQueryCount = 0;

  return {
    from(table: string) {
      if (table === "assignments") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: ids.assignment,
                  lecturer_id: ids.lecturer,
                  title: "Essay 1",
                  description: "Compare integrity signals",
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "submissions") {
        return {
          select: () => ({
            eq: () => {
              submissionsQueryCount += 1;

              if (submissionsQueryCount === 1) {
                return {
                  in: async () => ({
                    data: [
                      {
                        id: ids.submissionC,
                        assignment_id: ids.assignment,
                        student_id: ids.studentC,
                        student_name: "Student C",
                        student_email: "c@example.com",
                        file_name: "c.txt",
                        file_url: "submission-c.txt",
                      },
                    ],
                    error: null,
                  }),
                };
              }

              return Promise.resolve({
                data: [],
                error: { message: "assignment-wide query failed" },
              });
            },
          }),
        };
      }

      throw new Error(`Unexpected user table ${table}`);
    },
  };
}

function createUserSupabaseMockWithMissingRequestedSubmission() {
  return {
    from(table: string) {
      if (table === "assignments") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: ids.assignment,
                  lecturer_id: ids.lecturer,
                  title: "Essay 1",
                  description: "Compare integrity signals",
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "submissions") {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected user table ${table}`);
    },
  };
}

function createUserSupabaseMockWithRequestedSubmissionsFailure() {
  return {
    from(table: string) {
      if (table === "assignments") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: ids.assignment,
                  lecturer_id: ids.lecturer,
                  title: "Essay 1",
                  description: "Compare integrity signals",
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "submissions") {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({
                data: null,
                error: { message: "requested submissions query failed" },
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected user table ${table}`);
    },
  };
}

function createLargeCohortUserSupabaseMock(cohortSize: number) {
  const cohortRows = buildLargeCohortRows(cohortSize);

  return {
    from(table: string) {
      if (table === "assignments") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: ids.assignment,
                  lecturer_id: ids.lecturer,
                  title: "Essay 1",
                  description: "Compare integrity signals",
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "submissions") {
        return {
          select: () => ({
            eq: () => {
              const assignmentWideResult: Promise<{ data: Array<Record<string, string>>; error: null }> = Promise.resolve({
                data: cohortRows,
                error: null,
              });

              (assignmentWideResult as Promise<{ data: Array<Record<string, string>>; error: null }> & {
                in: () => Promise<{ data: Array<Record<string, string>>; error: null }>;
              }).in = async () => ({
                data: [cohortRows[0]],
                error: null,
              });

              return assignmentWideResult as Promise<{ data: Array<Record<string, string>>; error: null }> & {
                in: () => Promise<{ data: Array<Record<string, string>>; error: null }>;
              };
            },
          }),
        };
      }

      throw new Error(`Unexpected user table ${table}`);
    },
  };
}

function createAdminSupabaseMock() {
  const integrityFindingUpsert = vi.fn(async () => ({ error: null }));
  const reviewUpsert = vi.fn(async () => ({ error: null }));
  const profileUpsert = vi.fn(async () => ({ error: null }));

  return {
    integrityFindingUpsert,
    reviewUpsert,
    profileUpsert,
    storage: {
      from: () => ({
        download: async (path: string) => ({
          data: new Blob([repeatedEssay], { type: "text/plain" }),
          error: null,
          path,
        }),
      }),
    },
    from(table: string) {
      if (table === "submissions") {
        return {
          select: () => ({
            eq: async () => ({
              data: [
                {
                  id: ids.submissionB,
                  assignment_id: ids.assignment,
                  student_id: ids.studentB,
                  student_name: "Student B",
                  student_email: "b@example.com",
                  file_name: "b.txt",
                  file_url: "submission-b.txt",
                },
                {
                  id: ids.submissionC,
                  assignment_id: ids.assignment,
                  student_id: ids.studentC,
                  student_name: "Student C",
                  student_email: "c@example.com",
                  file_name: "c.txt",
                  file_url: "submission-c.txt",
                },
              ],
              error: null,
            }),
            in: async () => ({
              data: [
                { id: ids.submissionB, student_id: ids.studentB },
                { id: ids.submissionC, student_id: ids.studentC },
              ],
              error: null,
            }),
          }),
        };
      }

      if (table === "student_writing_profiles") {
        return {
          select: () => ({
            in: async () => ({ data: [], error: null }),
          }),
          upsert: profileUpsert,
        };
      }

      if (table === "grades") {
        return {
          select: () => ({
            in: async () => ({ data: [], error: null }),
          }),
        };
      }

      if (table === "academic_integrity_reviews") {
        return {
          select: () => ({
            in: () => ({
              eq: async () => ({ data: [], error: null }),
            }),
          }),
          upsert: reviewUpsert,
        };
      }

      if (table === "integrity_findings") {
        return {
          upsert: integrityFindingUpsert,
        };
      }

      throw new Error(`Unexpected admin table ${table}`);
    },
  };
}

function createLowQualityExtractionAdminSupabaseMock() {
  const supabase = createAdminSupabaseMock();

  return {
    ...supabase,
    storage: {
      from: () => ({
        download: async (path: string) => ({
          data: new Blob([`[LOW_QUALITY_FIXTURE] ${repeatedEssay}`], { type: "application/pdf" }),
          error: null,
          path,
        }),
      }),
    },
  };
}

function createRequestedDownloadFailureAdminSupabaseMock() {
  const supabase = createAdminSupabaseMock();

  return {
    ...supabase,
    storage: {
      from: () => ({
        download: async (path: string) => {
          if (path === "submission-c.txt") {
            return {
              data: null,
              error: { message: "object not found" },
              path,
            };
          }

          return {
            data: new Blob([repeatedEssay], { type: "text/plain" }),
            error: null,
            path,
          };
        },
      }),
    },
  };
}

function createUnreadablePeerAdminSupabaseMock() {
  const supabase = createAdminSupabaseMock();

  return {
    ...supabase,
    storage: {
      from: () => ({
        download: async (path: string) => {
          if (path === "submission-b.txt") {
            return {
              data: null,
              error: { message: "object not found" },
              path,
            };
          }

          return {
            data: new Blob([repeatedEssay], { type: "text/plain" }),
            error: null,
            path,
          };
        },
      }),
    },
  };
}

function createFailingIntegrityFindingsAdminSupabaseMock() {
  const supabase = createAdminSupabaseMock();
  supabase.integrityFindingUpsert.mockImplementation(async () => ({
    error: { code: "23505", message: "upsert failed" },
  }));
  return supabase;
}

function createFailingIntegrityReviewsAdminSupabaseMock() {
  const supabase = createAdminSupabaseMock();
  supabase.reviewUpsert.mockImplementation(async () => ({
    error: { code: "23505", message: "review upsert failed" },
  }));
  return supabase;
}

function createLargeCohortAdminSupabaseMock(cohortSize: number) {
  const cohortRows = buildLargeCohortRows(cohortSize);
  const integrityFindingUpsert = vi.fn(async () => ({ error: null }));
  const reviewUpsert = vi.fn(async () => ({ error: null }));
  const profileUpsert = vi.fn(async () => ({ error: null }));

  return {
    integrityFindingUpsert,
    reviewUpsert,
    profileUpsert,
    storage: {
      from: () => ({
        download: async (path: string) => ({
          data: new Blob([repeatedEssay], { type: "text/plain" }),
          error: null,
          path,
        }),
      }),
    },
    from(table: string) {
      if (table === "submissions") {
        return {
          select: () => ({
            in: async () => ({
              data: cohortRows.map((row) => ({ id: row.id, student_id: row.student_id })),
              error: null,
            }),
          }),
        };
      }

      if (table === "student_writing_profiles") {
        return {
          select: () => ({
            in: async () => ({ data: [], error: null }),
          }),
          upsert: profileUpsert,
        };
      }

      if (table === "grades") {
        return {
          select: () => ({
            in: async () => ({ data: [], error: null }),
          }),
        };
      }

      if (table === "academic_integrity_reviews") {
        return {
          select: () => ({
            in: () => ({
              eq: async () => ({ data: [], error: null }),
            }),
          }),
          upsert: reviewUpsert,
        };
      }

      if (table === "integrity_findings") {
        return {
          upsert: integrityFindingUpsert,
        };
      }

      throw new Error(`Unexpected admin table ${table}`);
    },
  };
}

describe("check-plagiarism handler", () => {
  const originalProviderMode = process.env.INTEGRITY_PROVIDER_MODE;
  const originalMossEnabled = process.env.MOSS_PROVIDER_ENABLED;
  const originalMossRunnerUrl = process.env.MOSS_RUNNER_URL;
  const originalMossRunnerApiSecret = process.env.MOSS_RUNNER_API_SECRET;
  const originalMossRunnerTimeout = process.env.MOSS_RUNNER_TIMEOUT_MS;

  beforeEach(() => {
    resetRateLimitStore();
    process.env.INTEGRITY_PROVIDER_MODE = "internal_text_similarity";
  });

  it("returns internal similarity flags for a requested submission without calling OpenAI", async () => {
    const adminSupabase = createAdminSupabaseMock();
    const openAiMock = vi.fn();

    const handler = createCheckPlagiarismHandler({
      createAdminClient: () => adminSupabase,
      requireLecturer: async () => ({
        supabase: createUserSupabaseMock(),
        user: { id: ids.lecturer },
      }),
      jsonError: (error) =>
        new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
      createCorsForbiddenResponse: () => new Response("forbidden", { status: 403 }),
      createIntegrityResponseWithRetry: openAiMock,
    });

    const response = await handler(
      new Request("https://gradeai.test/functions/v1/check-plagiarism", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          assignmentId: ids.assignment,
          submissionIds: [ids.submissionC],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(openAiMock).not.toHaveBeenCalled();
    expect(payload.flags).toHaveLength(1);
    expect(payload.flags[0]).toMatchObject({
      submission_a_id: ids.submissionC,
      submission_b_id: ids.submissionB,
      student_a: "Student C",
      student_b: "Student B",
      integrity_type: "similarity",
    });
    expect(payload.summary).toContain("1 submission(s) crossed");
    expect(adminSupabase.integrityFindingUpsert).toHaveBeenCalledTimes(1);
    expect(adminSupabase.reviewUpsert).toHaveBeenCalledTimes(1);
  });

  it("runs the optional MOSS bridge for code submissions without breaking the existing flow", async () => {
    process.env.INTEGRITY_PROVIDER_MODE = "both";
    process.env.MOSS_PROVIDER_ENABLED = "true";
    process.env.MOSS_RUNNER_URL = "https://moss-runner.test/moss";
    process.env.MOSS_RUNNER_API_SECRET = "runner-secret";
    process.env.MOSS_RUNNER_TIMEOUT_MS = "5000";

    const adminSupabase = createAdminSupabaseMock();
    const openAiMock = vi.fn(async () => ({ flags: [], summary: "Legacy analysis completed." }));
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        report_url: "https://moss.example/report/123",
        findings: [
          {
            submission_id: ids.submissionC,
            compared_submission_id: ids.submissionB,
            similarity_score: 91,
            severity: "high",
            evidence_summary: "MOSS reported strong code overlap.",
            matched_phrases: ["def reconcile_queue(items):"],
            raw_metadata: { match_path: "/match-1.html" },
          },
        ],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createCheckPlagiarismHandler({
      createAdminClient: () => adminSupabase,
      requireLecturer: async () => ({
        supabase: createCodeUserSupabaseMock(),
        user: { id: ids.lecturer },
      }),
      jsonError: (error) =>
        new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
      createCorsForbiddenResponse: () => new Response("forbidden", { status: 403 }),
      createIntegrityResponseWithRetry: openAiMock,
    });

    const response = await handler(
      new Request("https://gradeai.test/functions/v1/check-plagiarism", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          assignmentId: ids.assignment,
          submissionIds: [ids.submissionC],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(openAiMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://moss-runner.test/moss",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-api-key": "runner-secret",
        }),
      }),
    );
    expect(payload.flags).toHaveLength(1);
    expect(payload.flags[0]).toMatchObject({
      submission_a_id: ids.submissionC,
      submission_b_id: ids.submissionB,
      integrity_type: "similarity",
    });
    expect(adminSupabase.integrityFindingUpsert).toHaveBeenCalled();
    expect(adminSupabase.integrityFindingUpsert.mock.calls.flat().some((arg) =>
      Array.isArray(arg) &&
      arg.some((row) => row.provider === "moss")
    )).toBe(true);
  });

  it("merges internal and AI similarity signals in both mode without duplicate pair flags", async () => {
    process.env.INTEGRITY_PROVIDER_MODE = "both";

    const adminSupabase = createAdminSupabaseMock();
    const openAiMock = vi.fn(async () => ({
      output_text: JSON.stringify({
        flags: [
          {
            submission_a_id: ids.submissionC,
            submission_b_id: ids.submissionB,
            student_a: "Student C",
            student_b: "Student B",
            similarity_score: 72,
            ai_suspicion_score: 58,
            baseline_deviation_score: 0,
            total_risk_score: 65,
            reason: "Shared technical phrasing suggests suspicious overlap.",
            evidence_summary: "AI review found repeated technical phrasing and unusually aligned structure.",
            matched_excerpt: "quaternion telemetry drift lattice calibration error asynchronous checksum recovery",
            recommended_action: "review",
            integrity_type: "similarity",
            severity: "medium",
            overlap_analysis: {
              total_overlap: 72,
              cited_overlap: 0,
              uncited_overlap: 72,
              internal_peer_overlap: 72,
              external_source_overlap: 0,
            },
            evidence_groups: {
              uncited_matches: [],
              cited_matches: [],
              peer_matches: [],
              external_matches: [],
            },
          },
        ],
        summary: "AI integrity review identified one suspicious similarity pair.",
      }),
    }));

    const handler = createCheckPlagiarismHandler({
      createAdminClient: () => adminSupabase,
      requireLecturer: async () => ({
        supabase: createUserSupabaseMock(),
        user: { id: ids.lecturer },
      }),
      jsonError: (error) =>
        new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
      createCorsForbiddenResponse: () => new Response("forbidden", { status: 403 }),
      createIntegrityResponseWithRetry: openAiMock,
    });

    const response = await handler(
      new Request("https://gradeai.test/functions/v1/check-plagiarism", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          assignmentId: ids.assignment,
          submissionIds: [ids.submissionC],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(openAiMock).toHaveBeenCalledTimes(1);
    expect(payload.flags).toHaveLength(1);
    expect(payload.flags[0]).toMatchObject({
      submission_a_id: ids.submissionC,
      submission_b_id: ids.submissionB,
      integrity_type: "similarity",
    });
    expect(payload.flags[0].similarity_score).toBeGreaterThanOrEqual(72);
    expect(payload.flags[0].ai_suspicion_score).toBe(58);
    expect(payload.flags[0].reason).toContain("Shared technical phrasing suggests suspicious overlap.");
    expect(payload.summary).toContain("1 submission(s) crossed");
  });

  it("falls back to internal similarity when OpenAI fails in both mode", async () => {
    process.env.INTEGRITY_PROVIDER_MODE = "both";

    const adminSupabase = createAdminSupabaseMock();
    const openAiMock = vi.fn(async () => {
      throw new Error("OpenAI temporarily unavailable");
    });

    const handler = createCheckPlagiarismHandler({
      createAdminClient: () => adminSupabase,
      requireLecturer: async () => ({
        supabase: createUserSupabaseMock(),
        user: { id: ids.lecturer },
      }),
      jsonError: (error) =>
        new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
      createCorsForbiddenResponse: () => new Response("forbidden", { status: 403 }),
      createIntegrityResponseWithRetry: openAiMock,
    });

    const response = await handler(
      new Request("https://gradeai.test/functions/v1/check-plagiarism", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          assignmentId: ids.assignment,
          submissionIds: [ids.submissionC],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(openAiMock).toHaveBeenCalledTimes(1);
    expect(payload.flags).toHaveLength(1);
    expect(payload.flags[0]).toMatchObject({
      submission_a_id: ids.submissionC,
      submission_b_id: ids.submissionB,
      integrity_type: "similarity",
    });
    expect(payload.warnings).toContain(
      "AI similarity analysis was temporarily unavailable; returning baseline and persistence-safe results only.",
    );
    expect(payload.summary).toContain("1 submission(s) crossed");
  });

  it("returns flags and warnings when internal finding persistence fails", async () => {
    process.env.INTEGRITY_PROVIDER_MODE = "internal_text_similarity";

    const adminSupabase = createFailingIntegrityFindingsAdminSupabaseMock();
    const openAiMock = vi.fn();

    const handler = createCheckPlagiarismHandler({
      createAdminClient: () => adminSupabase,
      requireLecturer: async () => ({
        supabase: createUserSupabaseMock(),
        user: { id: ids.lecturer },
      }),
      jsonError: (error) =>
        new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
      createCorsForbiddenResponse: () => new Response("forbidden", { status: 403 }),
      createIntegrityResponseWithRetry: openAiMock,
    });

    const response = await handler(
      new Request("https://gradeai.test/functions/v1/check-plagiarism", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          assignmentId: ids.assignment,
          submissionIds: [ids.submissionC],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(openAiMock).not.toHaveBeenCalled();
    expect(payload.flags).toHaveLength(1);
    expect(payload.warnings).toContain("Internal similarity evidence could not be stored, but analysis completed.");
    expect(payload.summary).toContain("1 submission(s) crossed");
    expect(adminSupabase.integrityFindingUpsert).toHaveBeenCalledTimes(1);
  });

  it("returns flags and warnings when academic integrity review persistence fails", async () => {
    process.env.INTEGRITY_PROVIDER_MODE = "internal_text_similarity";

    const adminSupabase = createFailingIntegrityReviewsAdminSupabaseMock();
    const openAiMock = vi.fn();

    const handler = createCheckPlagiarismHandler({
      createAdminClient: () => adminSupabase,
      requireLecturer: async () => ({
        supabase: createUserSupabaseMock(),
        user: { id: ids.lecturer },
      }),
      jsonError: (error) =>
        new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
      createCorsForbiddenResponse: () => new Response("forbidden", { status: 403 }),
      createIntegrityResponseWithRetry: openAiMock,
    });

    const response = await handler(
      new Request("https://gradeai.test/functions/v1/check-plagiarism", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          assignmentId: ids.assignment,
          submissionIds: [ids.submissionC],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(openAiMock).not.toHaveBeenCalled();
    expect(payload.flags).toHaveLength(1);
    expect(payload.warnings).toContain("Integrity review records could not be stored, but analysis completed.");
    expect(payload.summary).toContain("1 submission(s) crossed");
    expect(adminSupabase.reviewUpsert).toHaveBeenCalledTimes(1);
  });

  it("suppresses unreliable similarity when extraction quality is not usable", async () => {
    process.env.INTEGRITY_PROVIDER_MODE = "internal_text_similarity";

    const adminSupabase = createLowQualityExtractionAdminSupabaseMock();
    const openAiMock = vi.fn();

    const handler = createCheckPlagiarismHandler({
      createAdminClient: () => adminSupabase,
      requireLecturer: async () => ({
        supabase: createUserSupabaseMock(),
        user: { id: ids.lecturer },
      }),
      jsonError: (error) =>
        new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
      createCorsForbiddenResponse: () => new Response("forbidden", { status: 403 }),
      createIntegrityResponseWithRetry: openAiMock,
    });

    const response = await handler(
      new Request("https://gradeai.test/functions/v1/check-plagiarism", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          assignmentId: ids.assignment,
          submissionIds: [ids.submissionC],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(openAiMock).not.toHaveBeenCalled();
    expect(payload.flags).toHaveLength(0);
    expect(payload.warnings.some((warning: string) => warning.includes("Low-quality PDF extraction"))).toBe(true);
    expect(payload.summary).toContain("No submissions crossed the current integrity thresholds.");
    expect(adminSupabase.integrityFindingUpsert).not.toHaveBeenCalled();
  });

  it("returns a warning and no flags when the requested submission file cannot be downloaded", async () => {
    process.env.INTEGRITY_PROVIDER_MODE = "internal_text_similarity";

    const adminSupabase = createRequestedDownloadFailureAdminSupabaseMock();
    const openAiMock = vi.fn();

    const handler = createCheckPlagiarismHandler({
      createAdminClient: () => adminSupabase,
      requireLecturer: async () => ({
        supabase: createUserSupabaseMock(),
        user: { id: ids.lecturer },
      }),
      jsonError: (error) =>
        new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
      createCorsForbiddenResponse: () => new Response("forbidden", { status: 403 }),
      createIntegrityResponseWithRetry: openAiMock,
    });

    const response = await handler(
      new Request("https://gradeai.test/functions/v1/check-plagiarism", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          assignmentId: ids.assignment,
          submissionIds: [ids.submissionC],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(openAiMock).not.toHaveBeenCalled();
    expect(payload.flags).toHaveLength(0);
    expect(payload.warnings).toContain("c.txt: Document extraction failed");
    expect(payload.summary).toContain("No submissions crossed the current integrity thresholds.");
    expect(adminSupabase.integrityFindingUpsert).not.toHaveBeenCalled();
  });

  it("degrades cleanly when comparison submissions cannot be materialized", async () => {
    process.env.INTEGRITY_PROVIDER_MODE = "internal_text_similarity";

    const adminSupabase = createUnreadablePeerAdminSupabaseMock();
    const openAiMock = vi.fn();

    const handler = createCheckPlagiarismHandler({
      createAdminClient: () => adminSupabase,
      requireLecturer: async () => ({
        supabase: createUserSupabaseMock(),
        user: { id: ids.lecturer },
      }),
      jsonError: (error) =>
        new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
      createCorsForbiddenResponse: () => new Response("forbidden", { status: 403 }),
      createIntegrityResponseWithRetry: openAiMock,
    });

    const response = await handler(
      new Request("https://gradeai.test/functions/v1/check-plagiarism", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          assignmentId: ids.assignment,
          submissionIds: [ids.submissionC],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(openAiMock).not.toHaveBeenCalled();
    expect(payload.flags).toHaveLength(0);
    expect(payload.warnings).toEqual([]);
    expect(payload.summary).toContain("No submissions crossed the current integrity thresholds.");
    expect(adminSupabase.integrityFindingUpsert).not.toHaveBeenCalled();
  });

  it("fails explicitly when the assignment-wide cohort query errors", async () => {
    process.env.INTEGRITY_PROVIDER_MODE = "internal_text_similarity";

    const adminSupabase = createAdminSupabaseMock();
    const openAiMock = vi.fn();

    const handler = createCheckPlagiarismHandler({
      createAdminClient: () => adminSupabase,
      requireLecturer: async () => ({
        supabase: createUserSupabaseMockWithAssignmentWideFailure(),
        user: { id: ids.lecturer },
      }),
      jsonError: (error) =>
        new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
      createCorsForbiddenResponse: () => new Response("forbidden", { status: 403 }),
      createIntegrityResponseWithRetry: openAiMock,
    });

    const response = await handler(
      new Request("https://gradeai.test/functions/v1/check-plagiarism", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          assignmentId: ids.assignment,
          submissionIds: [ids.submissionC],
        }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "Failed to load assignment submissions",
    });
    expect(openAiMock).not.toHaveBeenCalled();
    expect(adminSupabase.integrityFindingUpsert).not.toHaveBeenCalled();
    expect(adminSupabase.reviewUpsert).not.toHaveBeenCalled();
  });

  it("returns 403 when one or more requested submissions are not accessible", async () => {
    process.env.INTEGRITY_PROVIDER_MODE = "internal_text_similarity";

    const adminSupabase = createAdminSupabaseMock();
    const openAiMock = vi.fn();
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const handler = createCheckPlagiarismHandler({
      createAdminClient: () => adminSupabase,
      requireLecturer: async () => ({
        supabase: createUserSupabaseMockWithMissingRequestedSubmission(),
        user: { id: ids.lecturer },
      }),
      jsonError: (error) =>
        new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
          status: error instanceof Error && "status" in error && typeof (error as { status?: unknown }).status === "number"
            ? ((error as { status: number }).status)
            : 500,
          headers: { "Content-Type": "application/json" },
        }),
      getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
      createCorsForbiddenResponse: () => new Response("forbidden", { status: 403 }),
      createIntegrityResponseWithRetry: openAiMock,
    });

    const response = await handler(
      new Request("https://gradeai.test/functions/v1/check-plagiarism", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          assignmentId: ids.assignment,
          submissionIds: [ids.submissionC],
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "One or more submissions are not accessible",
    });
    expect(consoleWarn).toHaveBeenCalledWith(
      "check-plagiarism inaccessible_requested_submissions",
      expect.objectContaining({
        assignmentId: ids.assignment,
        requestedSubmissionCount: 1,
        loadedSubmissionCount: 0,
      }),
    );
    expect(openAiMock).not.toHaveBeenCalled();
    expect(adminSupabase.integrityFindingUpsert).not.toHaveBeenCalled();
    expect(adminSupabase.reviewUpsert).not.toHaveBeenCalled();
  });

  it("returns 500 when the requested submissions query fails", async () => {
    process.env.INTEGRITY_PROVIDER_MODE = "internal_text_similarity";

    const adminSupabase = createAdminSupabaseMock();
    const openAiMock = vi.fn();

    const handler = createCheckPlagiarismHandler({
      createAdminClient: () => adminSupabase,
      requireLecturer: async () => ({
        supabase: createUserSupabaseMockWithRequestedSubmissionsFailure(),
        user: { id: ids.lecturer },
      }),
      jsonError: (error) =>
        new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
          status: error instanceof Error && "status" in error && typeof (error as { status?: unknown }).status === "number"
            ? ((error as { status: number }).status)
            : 500,
          headers: { "Content-Type": "application/json" },
        }),
      getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
      createCorsForbiddenResponse: () => new Response("forbidden", { status: 403 }),
      createIntegrityResponseWithRetry: openAiMock,
    });

    const response = await handler(
      new Request("https://gradeai.test/functions/v1/check-plagiarism", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          assignmentId: ids.assignment,
          submissionIds: [ids.submissionC],
        }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "Failed to load submissions",
    });
    expect(openAiMock).not.toHaveBeenCalled();
    expect(adminSupabase.integrityFindingUpsert).not.toHaveBeenCalled();
    expect(adminSupabase.reviewUpsert).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid request body with no assignment identifier", async () => {
    process.env.INTEGRITY_PROVIDER_MODE = "internal_text_similarity";

    const adminSupabase = createAdminSupabaseMock();
    const openAiMock = vi.fn();

    const handler = createCheckPlagiarismHandler({
      createAdminClient: () => adminSupabase,
      requireLecturer: async () => ({
        supabase: createUserSupabaseMock(),
        user: { id: ids.lecturer },
      }),
      jsonError: (error) =>
        new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
      createCorsForbiddenResponse: () => new Response("forbidden", { status: 403 }),
      createIntegrityResponseWithRetry: openAiMock,
    });

    const response = await handler(
      new Request("https://gradeai.test/functions/v1/check-plagiarism", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid request format",
      message: "Please provide the assignment that should be analyzed.",
    });
    expect(openAiMock).not.toHaveBeenCalled();
    expect(adminSupabase.integrityFindingUpsert).not.toHaveBeenCalled();
    expect(adminSupabase.reviewUpsert).not.toHaveBeenCalled();
  });

  it("returns 400 when submissionIds exceeds the maximum batch size", async () => {
    process.env.INTEGRITY_PROVIDER_MODE = "internal_text_similarity";

    const adminSupabase = createAdminSupabaseMock();
    const openAiMock = vi.fn();
    const oversizedSubmissionIds = Array.from({ length: 81 }, (_, index) =>
      `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
    );

    const handler = createCheckPlagiarismHandler({
      createAdminClient: () => adminSupabase,
      requireLecturer: async () => ({
        supabase: createUserSupabaseMock(),
        user: { id: ids.lecturer },
      }),
      jsonError: (error) =>
        new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
      createCorsForbiddenResponse: () => new Response("forbidden", { status: 403 }),
      createIntegrityResponseWithRetry: openAiMock,
    });

    const response = await handler(
      new Request("https://gradeai.test/functions/v1/check-plagiarism", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          assignmentId: ids.assignment,
          submissionIds: oversizedSubmissionIds,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid request format",
      message: "Please provide a valid submission ID or list of submission IDs.",
    });
    expect(openAiMock).not.toHaveBeenCalled();
    expect(adminSupabase.integrityFindingUpsert).not.toHaveBeenCalled();
    expect(adminSupabase.reviewUpsert).not.toHaveBeenCalled();
  });

  it("accepts the legacy submissions array shape and analyzes the requested ids", async () => {
    process.env.INTEGRITY_PROVIDER_MODE = "internal_text_similarity";

    const adminSupabase = createAdminSupabaseMock();
    const openAiMock = vi.fn();

    const handler = createCheckPlagiarismHandler({
      createAdminClient: () => adminSupabase,
      requireLecturer: async () => ({
        supabase: createUserSupabaseMock(),
        user: { id: ids.lecturer },
      }),
      jsonError: (error) =>
        new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
      createCorsForbiddenResponse: () => new Response("forbidden", { status: 403 }),
      createIntegrityResponseWithRetry: openAiMock,
    });

    const response = await handler(
      new Request("https://gradeai.test/functions/v1/check-plagiarism", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          assignment: { id: ids.assignment },
          submissions: [{ id: ids.submissionC }],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(openAiMock).not.toHaveBeenCalled();
    expect(payload.flags).toHaveLength(1);
    expect(payload.flags[0]).toMatchObject({
      submission_a_id: ids.submissionC,
      submission_b_id: ids.submissionB,
      integrity_type: "similarity",
    });
    expect(payload.summary).toContain("1 submission(s) crossed");
    expect(adminSupabase.integrityFindingUpsert).toHaveBeenCalledTimes(1);
    expect(adminSupabase.reviewUpsert).toHaveBeenCalledTimes(1);
  });

  it("supports assignment-level integrity checks without requiring client-side submission batches", async () => {
    const adminSupabase = createAdminSupabaseMock();
    const openAiMock = vi.fn();

    const handler = createCheckPlagiarismHandler({
      createAdminClient: () => adminSupabase,
      requireLecturer: async () => ({
        supabase: createUserSupabaseMock(),
        user: { id: ids.lecturer },
      }),
      jsonError: (error) =>
        new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
      createCorsForbiddenResponse: () => new Response("forbidden", { status: 403 }),
      createIntegrityResponseWithRetry: openAiMock,
    });

    const response = await handler(
      new Request("https://gradeai.test/functions/v1/check-plagiarism", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          assignmentId: ids.assignment,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(openAiMock).not.toHaveBeenCalled();
    expect(payload.flags).toHaveLength(1);
    expect(payload.flags[0].integrity_type).toBe("similarity");
    expect(new Set([payload.flags[0].submission_a_id, payload.flags[0].submission_b_id])).toEqual(
      new Set([ids.submissionB, ids.submissionC]),
    );
    expect(payload.summary).toContain("1 submission(s) crossed");
    expect(adminSupabase.integrityFindingUpsert).toHaveBeenCalledTimes(1);
    expect(adminSupabase.reviewUpsert).toHaveBeenCalledTimes(1);
  });

  it("warns and skips internal cohort similarity for oversized assignments", async () => {
    process.env.INTEGRITY_PROVIDER_MODE = "internal_text_similarity";

    const adminSupabase = createLargeCohortAdminSupabaseMock(81);
    const openAiMock = vi.fn();
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const handler = createCheckPlagiarismHandler({
      createAdminClient: () => adminSupabase,
      requireLecturer: async () => ({
        supabase: createLargeCohortUserSupabaseMock(81),
        user: { id: ids.lecturer },
      }),
      jsonError: (error) =>
        new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
      createCorsForbiddenResponse: () => new Response("forbidden", { status: 403 }),
      createIntegrityResponseWithRetry: openAiMock,
    });

    const response = await handler(
      new Request("https://gradeai.test/functions/v1/check-plagiarism", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          assignmentId: ids.assignment,
          submissionIds: [ids.submissionC],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(openAiMock).not.toHaveBeenCalled();
    expect(payload.flags).toHaveLength(0);
    expect(payload.warnings).toContain(
      "Large assignment cohort detected (81 submissions). Integrity analysis may take longer than usual.",
    );
    expect(payload.warnings).toContain(
      "Internal cohort similarity scanning was skipped because this assignment has 81 submissions, exceeding the current safety limit of 80.",
    );
    expect(payload.summary).toContain("No submissions crossed the current integrity thresholds.");
    expect(consoleLog).toHaveBeenCalledWith(
      "comparison_submission_extraction_summary",
      expect.objectContaining({
        assignmentId: ids.assignment,
        cohortSubmissionCount: 81,
        extractionSubmissionCount: 1,
        requestedSubmissionCount: 1,
      }),
    );
    expect(consoleWarn).toHaveBeenCalledWith(
      "check-plagiarism completed_with_limitations",
      expect.objectContaining({
        assignmentId: ids.assignment,
        submissionCount: 1,
        flags: 0,
        warningCount: 2,
        warningCategories: expect.objectContaining({
          cohort: 2,
        }),
      }),
    );
    expect(adminSupabase.integrityFindingUpsert).not.toHaveBeenCalled();
  });

  afterEach(() => {
    process.env.INTEGRITY_PROVIDER_MODE = originalProviderMode;
    process.env.MOSS_PROVIDER_ENABLED = originalMossEnabled;
    process.env.MOSS_RUNNER_URL = originalMossRunnerUrl;
    process.env.MOSS_RUNNER_API_SECRET = originalMossRunnerApiSecret;
    process.env.MOSS_RUNNER_TIMEOUT_MS = originalMossRunnerTimeout;
    vi.restoreAllMocks();
  });
});
