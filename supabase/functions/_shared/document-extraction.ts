import { Buffer } from "node:buffer";
import mammoth from "npm:mammoth";
import {
  extractDocumentText,
  type DocumentExtractionResult,
} from "./document-extraction-core.ts";
import { logInfo, logWarn } from "./log.ts";

export { DOCUMENT_EXTRACTION_ERROR_MESSAGE } from "./document-extraction-core.ts";

export type DoclingFallbackConfig = {
  enabled: boolean;
  url: string;
  secret: string;
  timeoutMs: number;
};

type DoclingConversionResponse = {
  success?: boolean;
  text?: string | null;
  markdown?: string | null;
  warnings?: string[] | string | null;
  errors?: string[] | string | null;
  extraction_mode?: string | null;
  extracted_character_count?: number | null;
  extracted_word_count?: number | null;
  processing_duration_ms?: number | null;
};

function readEnv(name: string) {
  if (typeof process !== "undefined" && process.env) {
    return process.env[name];
  }

  if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    return Deno.env.get(name);
  }

  return undefined;
}

function parseBooleanEnv(value: string | null | undefined) {
  if (value == null || value.trim() === "") return null;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parsePositiveInteger(value: string | null | undefined, fallback: number) {
  if (value == null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  return normalized > 0 ? normalized : fallback;
}

function stringifyList(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  return [];
}

function normalizeDoclingText(input: string) {
  return input.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function countDoclingWords(input: string) {
  return (input.match(/\b[\p{L}\p{N}']+\b/gu) || []).length;
}

function countDoclingSentences(input: string) {
  return input
    .split(/(?<=[.?!])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20 && /\s/.test(sentence)).length;
}

function buildDoclingExtractionQuality(text: string) {
  const normalized = normalizeDoclingText(text);
  const words = countDoclingWords(normalized);
  const sentences = countDoclingSentences(normalized);
  const charCount = normalized.replace(/\s+/g, " ").trim().length;

  return {
    isUsable: words >= 40 && charCount >= 200,
    wordCount: words,
    artifactRatio: 0,
    qualityScore: words >= 40 && charCount >= 200 ? 100 : 0,
    reasons: [] as string[],
    readableSentenceCount: sentences,
    suspiciousTokenRatio: 0,
    suspiciousPdfArtifactCount: 0,
  };
}

function getDoclingFallbackConfig(): DoclingFallbackConfig | null {
  const url = readEnv("DOCLING_EXTRACTION_FALLBACK_URL")?.trim() ?? "";
  const secret = readEnv("DOCLING_EXTRACTION_FALLBACK_SECRET")?.trim() ?? "";
  const timeoutMs = parsePositiveInteger(readEnv("DOCLING_EXTRACTION_FALLBACK_TIMEOUT_MS"), 45_000);
  const explicitEnabled = parseBooleanEnv(readEnv("DOCLING_EXTRACTION_FALLBACK_ENABLED"));
  const enabled = explicitEnabled ?? Boolean(url && secret);

  if (!enabled || !url || !secret) {
    return null;
  }

  return {
    enabled,
    url: url.replace(/\/+$/, ""),
    secret,
    timeoutMs,
  };
}

function isDoclingFallbackEligible(result: DocumentExtractionResult) {
  return result.fileType === "pdf" && result.success === false;
}

async function fetchDoclingFallbackText(params: {
  config: DoclingFallbackConfig;
  fileData: Blob;
}): Promise<{
  success: boolean;
  text: string;
  warnings: string[];
  errors: string[];
  extractionMode: string | null;
  extractedCharacterCount: number | null;
  extractedWordCount: number | null;
  processingDurationMs: number | null;
  failureMessage: string | null;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.config.timeoutMs);
  try {
    const formData = new FormData();
    formData.append("file", params.fileData);

    const response = await globalThis.fetch(`${params.config.url}/convert`, {
      method: "POST",
      headers: {
        "x-docling-extraction-secret": params.config.secret,
      },
      body: formData,
      signal: controller.signal,
    });

    const responseText = await response.text();
    let payload: DoclingConversionResponse | null = null;
    try {
      payload = responseText ? JSON.parse(responseText) as DoclingConversionResponse : null;
    } catch {
      payload = null;
    }

    const warnings = stringifyList(payload?.warnings);
    const errors = stringifyList(payload?.errors);
    const text = normalizeDoclingText(
      typeof payload?.text === "string" && payload.text.trim().length > 0
        ? payload.text
        : typeof payload?.markdown === "string"
          ? payload.markdown
          : "",
    );

    if (!response.ok) {
      return {
        success: false,
        text: "",
        warnings,
        errors: errors.length > 0 ? errors : [`Docling service returned HTTP ${response.status}.`],
        extractionMode: payload?.extraction_mode ?? null,
        extractedCharacterCount: payload?.extracted_character_count ?? null,
        extractedWordCount: payload?.extracted_word_count ?? null,
        processingDurationMs: payload?.processing_duration_ms ?? null,
        failureMessage: `Docling service returned HTTP ${response.status}.`,
      };
    }

    return {
      success: Boolean(payload?.success ?? text.length > 0),
      text,
      warnings,
      errors,
      extractionMode: payload?.extraction_mode ?? null,
      extractedCharacterCount: payload?.extracted_character_count ?? text.length,
      extractedWordCount: payload?.extracted_word_count ?? (text.match(/\b[\p{L}\p{N}']+\b/gu) || []).length,
      processingDurationMs: payload?.processing_duration_ms ?? null,
      failureMessage: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Docling fallback error";
    return {
      success: false,
      text: "",
      warnings: [],
      errors: [message],
      extractionMode: null,
      extractedCharacterCount: null,
      extractedWordCount: null,
      processingDurationMs: null,
      failureMessage: message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function extractSubmissionDocument(params: {
  fileName?: string | null;
  mimeType?: string | null;
  fileData: Blob;
  doclingFallbackConfig?: DoclingFallbackConfig | null;
}): Promise<DocumentExtractionResult> {
  const bytes = new Uint8Array(await params.fileData.arrayBuffer());
  const localResult = await extractDocumentText({
    fileName: params.fileName,
    mimeType: params.mimeType,
    bytes,
    docxExtractor: async (bytes) => {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return {
        value: result.value,
        messages: result.messages?.map((message) => message.message).filter(Boolean) ?? [],
      };
    },
  });

  const doclingConfig = params.doclingFallbackConfig ?? getDoclingFallbackConfig();
  if (!doclingConfig || !isDoclingFallbackEligible(localResult)) {
    return localResult;
  }

  const doclingResult = await fetchDoclingFallbackText({
    config: doclingConfig,
    fileData: params.fileData,
  });

  if (!doclingResult.success || !doclingResult.text) {
    return localResult;
  }

  const normalizedText = normalizeDoclingText(doclingResult.text);
  const extractionQuality = buildDoclingExtractionQuality(normalizedText);

  if (!extractionQuality.isUsable) {
    return {
      ...localResult,
      extractionWarning: [
        localResult.extractionWarning,
        doclingResult.failureMessage,
        ...doclingResult.warnings,
        ...doclingResult.errors,
        ...extractionQuality.reasons,
      ].filter(Boolean).join(" ").trim() || localResult.extractionWarning,
      extractionQuality,
    };
  }

  const doclingWarnings = [
    localResult.extractionWarning,
    ...doclingResult.warnings,
    ...doclingResult.errors,
  ].filter(Boolean).join(" ").trim() || null;

  return {
    fileName: localResult.fileName,
    fileType: localResult.fileType,
    mimeType: localResult.mimeType,
    extractionMethod: "docling_remote",
    extractionFailureReason: null,
    extractedText: normalizedText,
    extractedTextLength: normalizedText.length,
    success: true,
    extractionWarning: doclingWarnings,
    extractionError: null,
    manualReviewRequired: false,
    extractionQuality,
  };
}

export function logDocumentExtractionResult(context: string, result: DocumentExtractionResult) {
  const payload = {
    fileName: result.fileName,
    fileType: result.fileType,
    mimeType: result.mimeType,
    extractionMethod: result.extractionMethod,
    extractionFailureReason: result.extractionFailureReason,
    extractedTextLength: result.extractedTextLength,
    success: result.success,
    warning: result.extractionWarning,
    error: result.extractionError,
    qualityScore: result.extractionQuality?.qualityScore ?? null,
    qualityWordCount: result.extractionQuality?.wordCount ?? null,
    qualityReadableSentenceCount: result.extractionQuality?.readableSentenceCount ?? null,
    qualitySuspiciousPdfArtifactCount: result.extractionQuality?.suspiciousPdfArtifactCount ?? null,
  };

  if (result.success) {
    logInfo(`${context} extraction`, payload);
    return;
  }

  logWarn(`${context} extraction failed`, payload);
}
