import type { AssignmentForGrading } from "./types.ts";
import type { RubricCriterion } from "./prompting.ts";
import type { DocumentExtractionResult } from "../_shared/document-extraction.ts";

export const PDF_EVIDENCE_INADEQUATE_MESSAGE =
  "We could not extract enough reliable text from this PDF for AI-assisted marking. Please upload a DOCX version or continue with manual review.";

export type PdfEvidenceAdequacyTelemetry = {
  file_type: string;
  extraction_method: string;
  assignment_type: string;
  extracted_text_length: number;
  word_count: number;
  readable_sentence_count: number;
  rubric_criterion_count: number;
  rubric_text_length: number;
  essay_like_assignment: boolean;
  substantial_context: boolean;
  minimum_word_count: number;
  minimum_character_count: number;
  minimum_sentence_count: number;
  reasons: string[];
};

export class PdfEvidenceAdequacyError extends Error {
  telemetry: PdfEvidenceAdequacyTelemetry;
  errorCode: "extraction_quality_failed";
  safeErrorCategory: "document_processing_failure";

  constructor(telemetry: PdfEvidenceAdequacyTelemetry) {
    super(PDF_EVIDENCE_INADEQUATE_MESSAGE);
    this.name = "PdfEvidenceAdequacyError";
    this.telemetry = telemetry;
    this.errorCode = "extraction_quality_failed";
    this.safeErrorCategory = "document_processing_failure";
  }
}

type ExtractionFailureTelemetry = {
  extraction_method: string;
  file_type: string;
  mime_type: string;
  extracted_text_length: number;
  extraction_quality_score: number | null;
  extraction_quality_word_count: number | null;
  extraction_quality_readable_sentence_count: number | null;
  extraction_quality_suspicious_pdf_artifact_count: number | null;
  parser_error?: {
    class: string | null;
    message: string | null;
  } | null;
};

export class ExtractionFailureError extends Error {
  telemetry: ExtractionFailureTelemetry;
  errorCode: "document_extraction_failed" | "extraction_quality_failed";
  safeErrorCategory: "document_processing_failure";

  constructor(params: {
    message: string;
    telemetry: ExtractionFailureTelemetry;
    errorCode: "document_extraction_failed" | "extraction_quality_failed";
  }) {
    super(params.message);
    this.name = "ExtractionFailureError";
    this.telemetry = params.telemetry;
    this.errorCode = params.errorCode;
    this.safeErrorCategory = "document_processing_failure";
  }
}

export function isDocumentExtractionError(
  error: unknown,
): error is ExtractionFailureError | PdfEvidenceAdequacyError {
  return error instanceof ExtractionFailureError || error instanceof PdfEvidenceAdequacyError;
}

export function sanitizeTelemetryString(value: string | null | undefined, maxLength = 200) {
  if (!value) return null;
  const sanitized = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maxLength);

  return sanitized || null;
}

export function buildExtractionFailureTelemetry(extraction: DocumentExtractionResult): ExtractionFailureTelemetry {
  const parserErrorClass = extraction.extractionFailureReason === "extractor_error" && extraction.extractionWarning
    ? "ExtractionParserError"
    : null;
  const parserErrorMessage = extraction.extractionFailureReason === "extractor_error"
    ? sanitizeTelemetryString(extraction.extractionWarning)
    : null;

  return {
    extraction_method: extraction.extractionMethod ?? "unknown",
    file_type: extraction.fileType ?? "unknown",
    mime_type: extraction.mimeType ?? "application/octet-stream",
    extracted_text_length: extraction.extractedTextLength ?? 0,
    extraction_quality_score: extraction.extractionQuality?.qualityScore ?? null,
    extraction_quality_word_count: extraction.extractionQuality?.wordCount ?? null,
    extraction_quality_readable_sentence_count:
      extraction.extractionQuality?.readableSentenceCount ?? null,
    extraction_quality_suspicious_pdf_artifact_count:
      extraction.extractionQuality?.suspiciousPdfArtifactCount ?? null,
    parser_error:
      parserErrorClass || parserErrorMessage
        ? {
          class: parserErrorClass,
          message: parserErrorMessage,
        }
        : null,
  };
}

function normalizeContextText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isSubstantialProseAssessmentContext(params: {
  assignment: AssignmentForGrading;
  normalizedRubric: RubricCriterion[];
  rubricText: string;
}) {
  const title = normalizeContextText(params.assignment.title);
  const description = normalizeContextText(params.assignment.description);
  const rubricText = normalizeContextText(params.rubricText);
  const rubricCriterionCount = params.normalizedRubric.length;
  const maximumScore = Number(params.assignment.max_score) || 0;
  const proseAssessmentSignals = [
    "essay",
    "report",
    "reflect",
    "reflection",
    "critical",
    "discussion",
    "analysis",
    "evaluate",
    "evaluation",
    "literature review",
    "case study",
    "argument",
    "written",
    "prose",
  ];
  const combinedContext = `${title}\n${description}\n${rubricText}`;
  const hasProseAssessmentSignal = proseAssessmentSignals.some((signal) => combinedContext.includes(signal));

  return (
    hasProseAssessmentSignal ||
    rubricCriterionCount >= 2 ||
    maximumScore >= 50 ||
    rubricText.length >= 180 ||
    description.length >= 120
  );
}

function countReadableSentences(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split(/(?<=[.?!])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20 && /\s/.test(sentence)).length;
}

function countWords(text: string) {
  return (text.match(/\b[\p{L}\p{N}']+\b/gu) || []).length;
}

function getTextLength(text: string) {
  return text.replace(/\r/g, "\n").trim().length;
}

function toPositiveInteger(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.trunc(numeric);
}

export function assessPdfEvidenceAdequacy(params: {
  assignment: AssignmentForGrading;
  normalizedRubric: RubricCriterion[];
  rubricText: string;
  extractedText: string;
  extractionMetadata?: Record<string, unknown>;
}): { isAdequate: boolean; telemetry: PdfEvidenceAdequacyTelemetry } {
  const fileType = typeof params.extractionMetadata?.file_type === "string"
    ? params.extractionMetadata?.file_type.toLowerCase()
    : "";
  const extractionMethod = typeof params.extractionMetadata?.extraction_method === "string"
    ? params.extractionMetadata?.extraction_method
    : "unknown";
  const substantialContext = isSubstantialProseAssessmentContext({
    assignment: params.assignment,
    normalizedRubric: params.normalizedRubric,
    rubricText: params.rubricText,
  });
  const extractedTextLength =
    toPositiveInteger(params.extractionMetadata?.extracted_text_length) ?? getTextLength(params.extractedText);
  const wordCount =
    toPositiveInteger(params.extractionMetadata?.extraction_quality_word_count) ?? countWords(params.extractedText);
  const readableSentenceCount =
    toPositiveInteger(params.extractionMetadata?.extraction_quality_readable_sentence_count) ??
    countReadableSentences(params.extractedText);
  const minimumWordCount = 120;
  const minimumCharacterCount = 900;
  const minimumSentenceCount = 4;
  const shouldGuardPdf = fileType === "pdf" && substantialContext;
  const reasons: string[] = [];

  if (shouldGuardPdf) {
    if (wordCount < minimumWordCount) {
      reasons.push(`Only ${wordCount} readable words were extracted from the PDF.`);
    }
    if (extractedTextLength < minimumCharacterCount) {
      reasons.push(`Only ${extractedTextLength} readable characters were extracted from the PDF.`);
    }
    if (readableSentenceCount < minimumSentenceCount) {
      reasons.push(`Only ${readableSentenceCount} readable sentence${readableSentenceCount === 1 ? "" : "s"} were extracted from the PDF.`);
    }
  }

  return {
    isAdequate: !shouldGuardPdf || reasons.length === 0,
    telemetry: {
      file_type: fileType || "unknown",
      extraction_method: extractionMethod,
      assignment_type: substantialContext ? "Substantial prose assessment" : "Short-form or non-prose assessment",
      extracted_text_length: extractedTextLength,
      word_count: wordCount,
      readable_sentence_count: readableSentenceCount,
      rubric_criterion_count: params.normalizedRubric.length,
      rubric_text_length: params.rubricText.trim().length,
      essay_like_assignment: substantialContext,
      substantial_context: substantialContext,
      minimum_word_count: minimumWordCount,
      minimum_character_count: minimumCharacterCount,
      minimum_sentence_count: minimumSentenceCount,
      reasons,
    },
  };
}
