// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DocumentExtractionResult } from "../../supabase/functions/_shared/document-extraction-core";

const mocks = vi.hoisted(() => ({
  extractDocumentText: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  mammoth: {
    extractRawText: vi.fn(),
  },
  fetch: vi.fn(),
}));

vi.mock("../../supabase/functions/_shared/document-extraction-core.ts", async () => {
  const actual = await vi.importActual<typeof import("../../supabase/functions/_shared/document-extraction-core.ts")>(
    "../../supabase/functions/_shared/document-extraction-core.ts",
  );
  return {
    ...actual,
    extractDocumentText: mocks.extractDocumentText,
  };
});

vi.mock("npm:mammoth", () => ({
  default: mocks.mammoth,
}));

vi.mock("../../supabase/functions/_shared/log.ts", () => ({
  logInfo: mocks.logInfo,
  logWarn: mocks.logWarn,
}));

vi.stubGlobal("fetch", mocks.fetch);

import {
  extractSubmissionDocument,
  logDocumentExtractionResult,
} from "../../supabase/functions/_shared/document-extraction";

const buildLocalResult = (overrides: Partial<DocumentExtractionResult> = {}): DocumentExtractionResult => ({
  fileName: "submission.pdf",
  fileType: "pdf",
  mimeType: "application/pdf",
  extractionMethod: "pdf_fallback",
  extractionFailureReason: "unreadable_pdf",
  extractedText: "",
  extractedTextLength: 0,
  success: false,
  extractionWarning: "Local extraction warning",
  extractionError: "Local extraction error",
  manualReviewRequired: true,
  extractionQuality: null,
  ...overrides,
});

describe("document extraction coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extractDocumentText.mockResolvedValue(buildLocalResult());
    mocks.fetch.mockReset();
    mocks.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          text: "Docling recovered enough text for a safe grade.".repeat(10),
          warnings: ["docling warning"],
          errors: [],
          extraction_mode: "remote",
          extracted_character_count: 420,
          extracted_word_count: 80,
          processing_duration_ms: 123,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
  });

  it("returns the local extraction when Docling is disabled or ineligible", async () => {
    mocks.extractDocumentText.mockResolvedValueOnce(buildLocalResult({ success: true, fileType: "txt" }));

    const result = await extractSubmissionDocument({
      fileName: "submission.txt",
      mimeType: "text/plain",
      fileData: new Blob(["Hello world"], { type: "text/plain" }),
      doclingFallbackConfig: null,
    });

    expect(result.success).toBe(true);
    expect(result.fileType).toBe("txt");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("falls back to the local result when Docling returns empty or failed output", async () => {
    mocks.extractDocumentText.mockResolvedValueOnce(buildLocalResult());
    mocks.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          text: "",
          warnings: ["remote warning"],
          errors: ["remote error"],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await extractSubmissionDocument({
      fileName: "submission.pdf",
      mimeType: "application/pdf",
      fileData: new Blob(["pdf"], { type: "application/pdf" }),
      doclingFallbackConfig: {
        enabled: true,
        url: "https://docling.example",
        secret: "secret",
        timeoutMs: 2500,
      },
    });

    expect(result).toMatchObject({
      success: false,
      extractionMethod: "pdf_fallback",
      extractionFailureReason: "unreadable_pdf",
      extractedText: "",
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns Docling output when the fallback text is usable", async () => {
    mocks.extractDocumentText.mockResolvedValueOnce(buildLocalResult());

    const result = await extractSubmissionDocument({
      fileName: "submission.pdf",
      mimeType: "application/pdf",
      fileData: new Blob(["pdf"], { type: "application/pdf" }),
      doclingFallbackConfig: {
        enabled: true,
        url: "https://docling.example",
        secret: "secret",
        timeoutMs: 2500,
      },
    });

    expect(result.success).toBe(true);
    expect(result.extractionMethod).toBe("docling_remote");
    expect(result.extractedText).toContain("Docling recovered enough text");
    expect(result.extractionWarning).toContain("docling warning");
    expect(result.extractionQuality?.isUsable).toBe(true);
  });

  it("keeps the local result when Docling returns text that is still unusable", async () => {
    mocks.extractDocumentText.mockResolvedValueOnce(buildLocalResult());
    mocks.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          text: "Too short to grade safely.",
          warnings: ["remote warning"],
          errors: ["remote error"],
          extraction_mode: "remote",
          extracted_character_count: 26,
          extracted_word_count: 5,
          processing_duration_ms: 50,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await extractSubmissionDocument({
      fileName: "submission.pdf",
      mimeType: "application/pdf",
      fileData: new Blob(["pdf"], { type: "application/pdf" }),
      doclingFallbackConfig: {
        enabled: true,
        url: "https://docling.example",
        secret: "secret",
        timeoutMs: 2500,
      },
    });

    expect(result.success).toBe(false);
    expect(result.extractionMethod).toBe("pdf_fallback");
    expect(result.extractionWarning).toContain("remote warning");
    expect(result.extractionQuality?.isUsable).toBe(false);
  });

  it("logs successful and failed extraction results", () => {
    logDocumentExtractionResult("document", buildLocalResult({ success: true, extractionWarning: null, extractionError: null }));
    logDocumentExtractionResult("document", buildLocalResult());

    expect(mocks.logInfo).toHaveBeenCalledWith(
      "document extraction",
      expect.objectContaining({
        fileName: "submission.pdf",
        success: true,
      }),
    );
    expect(mocks.logWarn).toHaveBeenCalledWith(
      "document extraction failed",
      expect.objectContaining({
        fileName: "submission.pdf",
        success: false,
      }),
    );
  });
});
