import {
  assessExtractionQuality,
  cleanExtractedDocumentText,
  extractReadablePdfText,
  type PdfExtractionMethod,
  type PdfTextParser,
  normalizeReadableText,
} from "./text-analysis.ts";

export const DOCUMENT_EXTRACTION_ERROR_MESSAGE =
  "We could not extract reliable readable content from this document. The PDF may be scanned, image-only, corrupted, or otherwise unreadable. Please review manually or request a readable re-upload.";
export const MIN_EXTRACTED_TEXT_CHARS = 200;

export type SupportedDocumentType = "code" | "docx" | "pdf" | "txt" | "unsupported";
export type ExtractionMethod =
  | "docx_mammoth"
  | PdfExtractionMethod
  | "plain_text_decoder"
  | "code_text_decoder"
  | "none";
export type ExtractionFailureReason =
  | "unsupported_submission_file"
  | "extractor_error"
  | "binary_like_content"
  | "extracted_text_too_short"
  | "unreadable_pdf"
  | "extracted_text_unusable";

const CODE_FILE_EXTENSIONS = [
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

export type DocxExtractor = (bytes: Uint8Array) => Promise<{
  value: string;
  messages?: string[];
}>;

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

export function detectDocumentType(fileName: string | null | undefined, mimeType: string | null | undefined): SupportedDocumentType {
  const normalizedMime = (mimeType || "").toLowerCase();
  const normalizedName = (fileName || "").toLowerCase();

  if (
    normalizedMime.includes("wordprocessingml.document") ||
    normalizedName.endsWith(".docx")
  ) {
    return "docx";
  }

  if (normalizedMime.includes("pdf") || normalizedName.endsWith(".pdf")) {
    return "pdf";
  }

  if (normalizedMime.startsWith("text/plain") || normalizedName.endsWith(".txt")) {
    return "txt";
  }

  if (
    normalizedMime.startsWith("text/") ||
    normalizedMime.includes("javascript") ||
    normalizedMime.includes("json") ||
    normalizedMime.includes("xml") ||
    normalizedMime.includes("yaml") ||
    normalizedMime.includes("x-python") ||
    CODE_FILE_EXTENSIONS.some((extension) => normalizedName.endsWith(extension))
  ) {
    return "code";
  }

  return "unsupported";
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
  const fileType = detectDocumentType(fileName, mimeType);

  const fail = (
    message: string,
    warning: string | null = null,
    options?: {
      extractionMethod?: ExtractionMethod;
      extractionFailureReason?: ExtractionFailureReason;
      extractedText?: string;
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
    extractionQuality: null,
  });

  if (fileType === "unsupported") {
    return fail(DOCUMENT_EXTRACTION_ERROR_MESSAGE, `Unsupported file type: ${mimeType || fileName}`);
  }

  let extractedText = "";
  let warningMessage: string | null = null;
  let extractionMethod: ExtractionMethod = "none";

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
  if (
    binaryLooksLikeOfficeArchive(params.bytes, normalizedText) ||
    looksLikeBinaryText(normalizedText)
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

  if (!normalizedText || normalizedText.trim().length < MIN_EXTRACTED_TEXT_CHARS) {
    const shortTextMessage =
      fileType === "pdf"
        ? "Readable PDF text was too short after extraction. The PDF may be scanned, image-only, corrupted, or otherwise unreadable."
        : `Readable text was too short after extraction (${normalizedText.trim().length} characters).`;
    return fail(
      DOCUMENT_EXTRACTION_ERROR_MESSAGE,
      shortTextMessage,
      {
        extractionMethod,
        extractionFailureReason: fileType === "pdf" ? "unreadable_pdf" : "extracted_text_too_short",
      },
    );
  }

  const extractionQuality = assessExtractionQuality(normalizedText, {
    fileType,
    rawText: extractedText,
  });
  if (!extractionQuality.isUsable) {
    const extractionQualityWarning =
      [warningMessage, ...extractionQuality.reasons].filter(Boolean).join(" ").trim() || null;
    return fail(
      DOCUMENT_EXTRACTION_ERROR_MESSAGE,
      extractionQualityWarning ?? "Extracted content was not reliable enough for grading.",
      {
        extractionMethod,
        extractionFailureReason: fileType === "pdf" ? "unreadable_pdf" : "extracted_text_unusable",
      },
    );
  }

  return {
    fileName,
    fileType,
    mimeType,
    extractionMethod,
    extractionFailureReason: null,
    extractedText: normalizedText,
    extractedTextLength: normalizedText.length,
    success: true,
    extractionWarning: warningMessage,
    extractionError: null,
    manualReviewRequired: false,
    extractionQuality,
  };
}
