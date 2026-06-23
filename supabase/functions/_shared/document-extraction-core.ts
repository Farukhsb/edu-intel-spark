import {
  assessExtractionQuality,
  cleanExtractedDocumentText,
  extractReadablePdfText,
  type PdfExtractionMethod,
  type PdfTextParser,
  normalizeReadableText,
} from "./text-analysis.ts";
import {
  detectSubmissionFileType,
  validateSubmissionFile,
} from "../../../src/lib/submissionValidation.ts";

export const DOCUMENT_EXTRACTION_ERROR_MESSAGE =
  "We could not extract reliable readable content from this document. The file may be empty, too large, corrupted, password-protected, scanned, image-only, or otherwise unreadable. Please review manually or request a readable re-upload.";
export const MIN_EXTRACTED_TEXT_CHARS = 200;

export type SupportedDocumentType = "code" | "docx" | "pdf" | "txt" | "unsupported";
export type ExtractionMethod =
  | "docx_mammoth"
  | PdfExtractionMethod
  | "docling_remote"
  | "plain_text_decoder"
  | "code_text_decoder"
  | "none";
export type ExtractionFailureReason =
  | "corrupted_docx"
  | "corrupted_pdf"
  | "empty_file"
  | "file_too_large"
  | "mime_type_mismatch"
  | "password_protected_pdf"
  | "unsupported_submission_file"
  | "extractor_error"
  | "binary_like_content"
  | "extracted_text_too_short"
  | "unreadable_pdf"
  | "extracted_text_unusable";

export type DocxExtractor = (bytes: Uint8Array) => Promise<{
  value: string;
  messages?: string[];
}>;

type DoclingExtractionResult = {
  success: boolean;
  text: string;
  warnings: string[];
  errors: string[];
};

export type DocumentExtractionResult = {
  fileName: string;
  fileType: string;
  mimeType: string;
  extractionMethod: ExtractionMethod;
  extractionFailureReason: ExtractionFailureReason | null;
  extractedText: string;
  extractedTextLength: number;
  success: boolean;
  extractionWarning: string | null;
  extractionError: string | null;
  manualReviewRequired: boolean;
  extractionQuality: ReturnType<typeof assessExtractionQuality> | null;
};

function binaryLooksLikeOfficeArchive(bytes: Uint8Array, text: string) {
  const startsWithZipMagic = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!startsWithZipMagic) return false;

  const preview = text.trim().slice(0, 24);
  if (!preview) return true;
  return preview.startsWith("PK");
}

function looksLikeBinaryText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("PK")) return true;

  let controlChars = 0;
  for (const character of trimmed) {
    const code = character.charCodeAt(0);
    const isControlChar =
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f);

    if (isControlChar) {
      controlChars++;
    }
  }

  return controlChars > Math.max(8, Math.floor(trimmed.length * 0.05));
}

function readEnv(name: string) {
  if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    return Deno.env.get(name);
  }

  if (typeof process !== "undefined" && process.env) {
    return process.env[name];
  }

  return undefined;
}

function readBooleanEnv(name: string) {
  const value = readEnv(name);
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function safeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDoclingFallbackConfig() {
  const url = readEnv("DOCLING_EXTRACTION_FALLBACK_URL")?.trim();
  const secret = readEnv("DOCLING_EXTRACTION_FALLBACK_SECRET")?.trim() || null;
  const explicitEnabled = readBooleanEnv("DOCLING_EXTRACTION_FALLBACK_ENABLED");
  const enabled = explicitEnabled || Boolean(url && secret);

  if (!enabled || !url || !secret) {
    return null;
  }

  const timeoutMs = Number(readEnv("DOCLING_EXTRACTION_FALLBACK_TIMEOUT_MS") || 15000);
  const normalizedTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.trunc(timeoutMs) : 15000;

  return {
    enabled,
    url,
    secret,
    timeoutMs: normalizedTimeoutMs,
  };
}

async function tryDoclingPdfFallback(params: {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
}): Promise<DoclingExtractionResult | null> {
  const config = getDoclingFallbackConfig();
  if (!config) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const form = new FormData();
    form.append("file", new Blob([params.bytes], { type: params.mimeType || "application/pdf" }), params.fileName);
    form.append("enable_ocr", "false");

    const headers = new Headers();
    if (config.secret) {
      headers.set("x-docling-extraction-secret", config.secret);
    }

    const response = await fetch(config.url, {
      method: "POST",
      headers,
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const payload = await response.json().catch(() => null) as
      | {
        success?: boolean;
        markdown?: string | null;
        text?: string | null;
        extracted_text?: string | null;
        warnings?: unknown;
        errors?: unknown;
      }
      | null;

    if (!payload || payload.success !== true) return null;

    const text = typeof payload.markdown === "string" && payload.markdown.trim().length > 0
      ? payload.markdown
      : typeof payload.text === "string" && payload.text.trim().length > 0
        ? payload.text
        : typeof payload.extracted_text === "string" && payload.extracted_text.trim().length > 0
          ? payload.extracted_text
          : "";

    if (!text.trim()) return null;

    return {
      success: true,
      text,
      warnings: safeStringList(payload.warnings),
      errors: safeStringList(payload.errors),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function detectDocumentType(fileName: string | null | undefined, mimeType: string | null | undefined): SupportedDocumentType {
  const fileType = detectSubmissionFileType(fileName);
  const normalizedMime = (mimeType || "").toLowerCase();

  switch (fileType) {
    case "docx":
      return normalizedMime.includes("wordprocessingml.document") ? "docx" : "unsupported";
    case "pdf":
      return normalizedMime.includes("pdf") ? "pdf" : "unsupported";
    case "txt":
      return normalizedMime.startsWith("text/plain") ? "txt" : "unsupported";
    case "code":
      return (
        normalizedMime.startsWith("text/") ||
        normalizedMime.includes("javascript") ||
        normalizedMime.includes("json") ||
        normalizedMime.includes("xml") ||
        normalizedMime.includes("yaml") ||
        normalizedMime.includes("x-python")
      )
        ? "code"
        : "unsupported";
    default:
      return "unsupported";
  }
}

export async function extractDocumentText(params: {
  fileName?: string | null;
  mimeType?: string | null;
  bytes: Uint8Array;
  docxExtractor?: DocxExtractor;
  pdfTextParser?: PdfTextParser;
}): Promise<DocumentExtractionResult> {
  const fileName = params.fileName || "submission";
  const mimeType = params.mimeType || "application/octet-stream";
  const fileType = detectSubmissionFileType(fileName);

  const fail = (
    message: string,
    warning: string | null = null,
    options?: {
      extractionMethod?: ExtractionMethod;
      extractionFailureReason?: ExtractionFailureReason;
      extractedText?: string;
      extractionQuality?: ReturnType<typeof assessExtractionQuality> | null;
    },
  ): DocumentExtractionResult => ({
    fileName,
    fileType,
    mimeType,
    extractionMethod: options?.extractionMethod ?? "none",
    extractionFailureReason: options?.extractionFailureReason ?? "extractor_error",
    extractedText: options?.extractedText ?? "",
    extractedTextLength: (options?.extractedText ?? "").length,
    success: false,
    extractionWarning: warning,
    extractionError: message,
    manualReviewRequired: true,
    extractionQuality: options?.extractionQuality ?? null,
  });

  const validation = validateSubmissionFile({
    fileName,
    mimeType,
    size: params.bytes.length,
    bytes: params.bytes,
  });

  if (!validation.ok) {
    return fail(validation.message, validation.message, {
      extractionFailureReason: validation.failureReason,
    });
  }

  if (fileType === "unsupported") {
    return fail(DOCUMENT_EXTRACTION_ERROR_MESSAGE, `Unsupported file type: ${mimeType || fileName}`);
  }

  let extractedText = "";
  let warningMessage: string | null = null;
  let extractionMethod: ExtractionMethod = "none";
  let doclingFallbackApplied = false;

  try {
    if (fileType === "docx") {
      if (!params.docxExtractor) {
        return fail(DOCUMENT_EXTRACTION_ERROR_MESSAGE, "DOCX extractor is not configured.", {
          extractionFailureReason: "extractor_error",
        });
      }

      const result = await params.docxExtractor(params.bytes);

      extractionMethod = "docx_mammoth";
      extractedText = cleanExtractedDocumentText(result.value || "");
      if (result.messages && result.messages.length > 0) {
        warningMessage = result.messages.join(" ");
      }
    } else if (fileType === "pdf") {
      const pdfExtraction = await extractReadablePdfText({
        bytes: params.bytes,
        parser: params.pdfTextParser,
      });
      extractionMethod = pdfExtraction.method;
      extractedText = pdfExtraction.text;
    } else {
      extractionMethod = fileType === "code" ? "code_text_decoder" : "plain_text_decoder";
      extractedText = cleanExtractedDocumentText(new TextDecoder().decode(params.bytes));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown extraction error";
    return fail(DOCUMENT_EXTRACTION_ERROR_MESSAGE, message, {
      extractionMethod,
      extractionFailureReason: "extractor_error",
    });
  }

  const normalizedText = normalizeReadableText(extractedText);
  const initialExtractionQuality = assessExtractionQuality(normalizedText, {
    fileType,
    rawText: extractedText,
  });
  let extractionQuality = initialExtractionQuality;

  if (fileType === "pdf" && !initialExtractionQuality.isUsable) {
    const doclingFallback = await tryDoclingPdfFallback({
      bytes: params.bytes,
      fileName,
      mimeType,
    });

    if (doclingFallback) {
      const doclingText = cleanExtractedDocumentText(doclingFallback.text);
      const doclingNormalizedText = normalizeReadableText(doclingText);
      const doclingQuality = assessExtractionQuality(doclingNormalizedText, {
        fileType,
        rawText: doclingText,
      });

      extractedText = doclingNormalizedText;
      extractionMethod = "pdf_docling_fallback";
      warningMessage = [
        warningMessage,
        ...doclingFallback.warnings,
        ...doclingFallback.errors,
        ...doclingQuality.reasons,
      ].filter(Boolean).join(" ").trim() || null;
      extractionQuality = doclingQuality;
      doclingFallbackApplied = true;
    }
  }

  const finalNormalizedText = doclingFallbackApplied ? extractedText : normalizedText;
  if (
    binaryLooksLikeOfficeArchive(params.bytes, finalNormalizedText) ||
    looksLikeBinaryText(finalNormalizedText)
  ) {
    return fail(
      DOCUMENT_EXTRACTION_ERROR_MESSAGE,
      "Extracted content still looks binary or unreadable after document parsing.",
      {
        extractionMethod,
        extractionFailureReason: "binary_like_content",
      },
    );
  }

  if (!finalNormalizedText || finalNormalizedText.trim().length < MIN_EXTRACTED_TEXT_CHARS) {
    const shortTextMessage =
      fileType === "pdf"
        ? "Readable PDF text was too short after extraction. The PDF may be scanned, image-only, corrupted, or otherwise unreadable."
        : `Readable text was too short after extraction (${finalNormalizedText.trim().length} characters).`;
    return fail(
      DOCUMENT_EXTRACTION_ERROR_MESSAGE,
      shortTextMessage,
      {
        extractionMethod,
        extractionFailureReason: fileType === "pdf" ? "unreadable_pdf" : "extracted_text_too_short",
      },
    );
  }

  if (!extractionQuality.isUsable) {
    const extractionQualityWarning =
      [warningMessage, ...extractionQuality.reasons].filter(Boolean).join(" ").trim() || null;
    return fail(
      DOCUMENT_EXTRACTION_ERROR_MESSAGE,
      extractionQualityWarning ?? "Extracted content was not reliable enough for grading.",
      {
        extractionMethod,
        extractionFailureReason: fileType === "pdf" ? "unreadable_pdf" : "extracted_text_unusable",
        extractionQuality,
      },
    );
  }

  return {
    fileName,
    fileType,
    mimeType,
    extractionMethod,
    extractionFailureReason: null,
    extractedText: finalNormalizedText,
    extractedTextLength: finalNormalizedText.length,
    success: true,
    extractionWarning: warningMessage,
    extractionError: null,
    manualReviewRequired: false,
    extractionQuality,
  };
}
