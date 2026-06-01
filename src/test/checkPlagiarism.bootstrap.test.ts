// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("../../supabase/functions/_shared/document-extraction", () => ({
  DOCUMENT_EXTRACTION_ERROR_MESSAGE: "Document extraction failed",
  extractSubmissionDocument: async (params: { fileName?: string | null; mimeType?: string | null; fileData: Blob }) => {
    const extractedText = await params.fileData.text();

    return {
      fileName: params.fileName ?? null,
      fileType: "txt",
      mimeType: params.mimeType ?? "text/plain",
      extractedText,
      extractedTextLength: extractedText.length,
      success: true,
      extractionWarning: null,
      extractionError: null,
    };
  },
  logDocumentExtractionResult: vi.fn(),
}));

import { registerCheckPlagiarismEntrypoint } from "../../supabase/functions/check-plagiarism/bootstrap";

describe("check-plagiarism bootstrap", () => {
  it("registers the handler with serve using the shared auth and CORS dependencies", async () => {
    process.env.INTEGRITY_PROVIDER_MODE = "internal_text_similarity";
    const serve = vi.fn((handler: (req: Request) => Promise<Response> | Response) => handler);
    const createAdminClient = vi.fn(() => ({
      rpc: async () => ({
        data: [{ allowed: true, retry_after_seconds: 0 }],
        error: null,
      }),
      storage: {
        from: () => ({
          download: async () => ({
            data: new Blob(["Short text that will not qualify for internal similarity scoring."], { type: "text/plain" }),
            error: null,
          }),
        }),
      },
      from: (table: string) => {
        if (table === "submissions") {
          return {
            select: () => ({
              in: async () => ({
                data: [
                  {
                    id: "66666666-6666-4666-8666-666666666666",
                    student_id: "44444444-4444-4444-8444-444444444444",
                  },
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
            upsert: async () => ({ error: null }),
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
            upsert: async () => ({ error: null }),
          };
        }

        if (table === "integrity_findings") {
          return {
            upsert: async () => ({ error: null }),
          };
        }

        throw new Error(`Unexpected admin table ${table}`);
      },
    }));
    const requireLecturer = vi.fn(async () => ({
      supabase: {
        from: (table: string) => {
          if (table === "assignments") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: "11111111-1111-4111-8111-111111111111",
                      lecturer_id: "22222222-2222-4222-8222-222222222222",
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
                    data: [
                      {
                        id: "66666666-6666-4666-8666-666666666666",
                        assignment_id: "11111111-1111-4111-8111-111111111111",
                        student_id: "44444444-4444-4444-8444-444444444444",
                        student_name: "Student C",
                        student_email: "c@example.com",
                        file_name: "c.txt",
                        file_url: "submission-c.txt",
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            };
          }

          throw new Error(`Unexpected user table ${table}`);
        },
      },
      user: { id: "22222222-2222-4222-8222-222222222222" },
    }));
    const jsonError = vi.fn((error: unknown, corsHeaders: Record<string, string>) =>
      new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    );
    const getCorsHeaders = vi.fn(() => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }));
    const createCorsForbiddenResponse = vi.fn(() => new Response("forbidden", { status: 403 }));

    const registered = registerCheckPlagiarismEntrypoint({
      serve,
      createAdminClient,
      requireLecturer,
      jsonError,
      getCorsHeaders,
      createCorsForbiddenResponse,
    });

    expect(serve).toHaveBeenCalledTimes(1);
    expect(typeof registered).toBe("function");

    const response = await (registered as (req: Request) => Promise<Response>)(
      new Request("https://gradeai.test/functions/v1/check-plagiarism", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          assignmentId: "11111111-1111-4111-8111-111111111111",
          submissionIds: ["66666666-6666-4666-8666-666666666666"],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.flags).toEqual([]);
    expect(payload.summary).toContain("No submissions crossed the current integrity thresholds.");
    expect(getCorsHeaders).toHaveBeenCalledTimes(1);
    expect(createCorsForbiddenResponse).not.toHaveBeenCalled();
    expect(requireLecturer).toHaveBeenCalledTimes(1);
    expect(createAdminClient).toHaveBeenCalledTimes(1);
    expect(jsonError).not.toHaveBeenCalled();
  });
});
