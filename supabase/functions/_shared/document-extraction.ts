import { Buffer } from "node:buffer";
import mammoth from "npm:mammoth";
import {
  extractDocumentText,
  type DocumentExtractionResult,
} from "./document-extraction-core.ts";
import { logInfo, logWarn } from "./log.ts";

export { DOCUMENT_EXTRACTION_ERROR_MESSAGE } from "./document-extraction-core.ts";

export async function extractSubmissionDocument(params: {
  fileName?: string | null;
  mimeType?: string | null;
  fileData: Blob;
}): Promise<DocumentExtractionResult> {
  const bytes = new Uint8Array(await params.fileData.arrayBuffer());
  return extractDocumentText({
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
}

export function logDocumentExtractionResult(context: string, result: DocumentExtractionResult) {
  const payload = {
    fileName: result.fileName,
    fileType: result.fileType,
    mimeType: result.mimeType,
    extractedTextLength: result.extractedTextLength,
    success: result.success,
    warning: result.extractionWarning,
    error: result.extractionError,
  };

  if (result.success) {
    logInfo(`${context} extraction`, payload);
    return;
  }

  logWarn(`${context} extraction failed`, payload);
}
