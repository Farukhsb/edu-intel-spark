// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  ExtractionFailureError,
  buildExtractionFailureTelemetry,
  isDocumentExtractionError,
  sanitizeTelemetryString,
} from "../../supabase/functions/grade-submission/pdf-adequacy";
import type { DocumentExtractionResult } from "../../supabase/functions/_shared/document-extraction";

describe("pdf adequacy helpers", () => {
  it("sanitizes telemetry and recognises extraction failures", () => {
    expect(sanitizeTelemetryString("  line1\nline2\tline3  ")).toBe("line1 line2 line3");

    const extraction = {
      extractionMethod: "docling",
      fileType: "pdf",
      mimeType: "application/pdf",
      extractedTextLength: 12,
      extractionFailureReason: "extractor_error",
      extractionWarning: "warning text",
      extractionQuality: {
        qualityScore: 0.2,
        wordCount: 4,
        readableSentenceCount: 1,
        suspiciousPdfArtifactCount: 2,
      },
    } as unknown as DocumentExtractionResult;

    const telemetry = buildExtractionFailureTelemetry(extraction);
    const error = new ExtractionFailureError({
      message: "Document extraction failed",
      telemetry,
      errorCode: "document_extraction_failed",
    });

    expect(telemetry.file_type).toBe("pdf");
    expect(telemetry.parser_error?.message).toBe("warning text");
    expect(isDocumentExtractionError(error)).toBe(true);
  });
});
