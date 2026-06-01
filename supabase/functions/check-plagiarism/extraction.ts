import { DOCUMENT_EXTRACTION_ERROR_MESSAGE, extractSubmissionDocument, logDocumentExtractionResult } from "../_shared/document-extraction.ts";
import type { AdminSupabaseClient } from "./request.ts";
import { assessExtractionQuality } from "../_shared/text-analysis.ts";

export async function fetchFileContent(
  supabaseAdmin: AdminSupabaseClient,
  sub: { file_url?: string; file_name?: string | null },
): Promise<{
  plainText: string;
  fullText: string | null;
  fileType: string;
  mimeType: string;
  success: boolean;
  extractionWarning: string | null;
  extractionError: string | null;
  extractionQuality: ReturnType<typeof assessExtractionQuality> | null;
}> {
  if (!sub.file_url) {
    return {
      plainText: "",
      fullText: null,
      fileType: "unsupported",
      mimeType: "application/octet-stream",
      success: false,
      extractionWarning: null,
      extractionError: DOCUMENT_EXTRACTION_ERROR_MESSAGE,
      extractionQuality: null,
    };
  }
  try {
    const { data, error } = await supabaseAdmin.storage.from("submissions").download(sub.file_url);
    if (error || !data) {
      return {
        plainText: "",
        fullText: null,
        fileType: "unsupported",
        mimeType: "application/octet-stream",
        success: false,
        extractionWarning: null,
        extractionError: DOCUMENT_EXTRACTION_ERROR_MESSAGE,
        extractionQuality: null,
      };
    }

    const mossLanguage = await import("../_shared/providers/moss.ts").then(({ detectMossLanguage }) => detectMossLanguage(sub.file_name || sub.file_url || null));
    if (mossLanguage) {
      const fullCodeText = await data.text();
      const codeText = fullCodeText.length > 12000 ? `${fullCodeText.slice(0, 12000)}\n\n[truncated]` : fullCodeText;
      return {
        plainText: codeText,
        fullText: fullCodeText,
        fileType: "code",
        mimeType: data.type || "text/plain",
        success: Boolean(codeText.trim()),
        extractionWarning: null,
        extractionError: codeText.trim() ? null : DOCUMENT_EXTRACTION_ERROR_MESSAGE,
        extractionQuality: codeText.trim() ? assessExtractionQuality(codeText) : null,
      };
    }

    const extraction = await extractSubmissionDocument({
      fileName: sub.file_name,
      mimeType: data.type,
      fileData: data,
    });

    logDocumentExtractionResult("check-plagiarism", extraction);

    const cleaned = extraction.extractedText.length > 12000 ? `${extraction.extractedText.slice(0, 12000)}\n\n[truncated]` : extraction.extractedText;
    return {
      plainText: cleaned,
      fullText: extraction.extractedText,
      fileType: extraction.fileType,
      mimeType: extraction.mimeType,
      success: extraction.success,
      extractionWarning: extraction.extractionWarning,
      extractionError: extraction.extractionError,
      extractionQuality: extraction.success ? assessExtractionQuality(cleaned) : null,
    };
  } catch {
    return {
      plainText: "",
      fullText: null,
      fileType: "unsupported",
      mimeType: "application/octet-stream",
      success: false,
      extractionWarning: null,
      extractionError: DOCUMENT_EXTRACTION_ERROR_MESSAGE,
      extractionQuality: null,
    };
  }
}

export function summarizeExtractionObservability(params: {
  cohortSubmissionCount: number;
  extractedComparisonContent: Array<{
    submission: { id: string };
    content: Awaited<ReturnType<typeof fetchFileContent>>;
  }>;
  requestedSubmissionIdSet: Set<string>;
}) {
  let failedExtractions = 0;
  let extractionWarnings = 0;
  let lowQualityRequestedSubmissions = 0;
  let usableRequestedSubmissions = 0;

  for (const { submission, content } of params.extractedComparisonContent) {
    if (!content.success) {
      failedExtractions += 1;
    }

    if (content.extractionWarning) {
      extractionWarnings += 1;
    }

    if (!params.requestedSubmissionIdSet.has(submission.id)) {
      continue;
    }

    if (content.extractionQuality?.isUsable) {
      usableRequestedSubmissions += 1;
    }

    if (content.extractionQuality && !content.extractionQuality.isUsable) {
      lowQualityRequestedSubmissions += 1;
    }
  }

  return {
    cohortSubmissionCount: params.cohortSubmissionCount,
    extractionSubmissionCount: params.extractedComparisonContent.length,
    requestedSubmissionCount: params.requestedSubmissionIdSet.size,
    usableRequestedSubmissions,
    failedExtractions,
    extractionWarnings,
    lowQualityRequestedSubmissions,
  };
}
