function sanitizeSafeMessage(value: string, maxLength = 240) {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function isOpenAIRequestTimeoutReason(reason: string) {
  const normalizedReason = reason.toLowerCase();
  return normalizedReason.includes("timed out after") || normalizedReason.includes("openai grading request timed out");
}

export function classifyGradingError(reason: string) {
  if (isOpenAIRequestTimeoutReason(reason)) {
    return { errorCode: "openai_timeout", safeErrorCategory: "service_failure" };
  }

  const normalizedReason = reason.toLowerCase();

  if (normalizedReason.includes("parse ai response")) {
    return { errorCode: "response_parse_failed", safeErrorCategory: "grading_failure" };
  }
  if (normalizedReason.includes("download")) {
    return { errorCode: "submission_download_failed", safeErrorCategory: "submission_access_failure" };
  }
  if (normalizedReason.includes("missing") && normalizedReason.includes("file url")) {
    return { errorCode: "submission_file_missing", safeErrorCategory: "submission_access_failure" };
  }
  if (normalizedReason.includes("supported")) {
    return { errorCode: "unsupported_submission_file", safeErrorCategory: "submission_validation_failure" };
  }
  if (normalizedReason.includes("extract")) {
    return { errorCode: "document_extraction_failed", safeErrorCategory: "document_processing_failure" };
  }

  return { errorCode: "grading_failed", safeErrorCategory: "grading_failure" };
}

export function toSafeGradingErrorMessage(reason: string) {
  if (isOpenAIRequestTimeoutReason(reason)) {
    return sanitizeSafeMessage(reason);
  }

  const normalizedReason = reason.toLowerCase();

  if (normalizedReason.includes("parse ai response")) {
    return "AI grading response could not be parsed.";
  }
  if (normalizedReason.includes("download")) {
    return "Submission file could not be downloaded.";
  }
  if (normalizedReason.includes("missing") && normalizedReason.includes("file url")) {
    return "Submission file URL is missing.";
  }
  if (normalizedReason.includes("supported")) {
    return "Submission file type is not supported.";
  }
  if (normalizedReason.includes("extract")) {
    return "Submission document extraction failed.";
  }

  return "AI grading failed for this submission.";
}

export function buildGradingErrorEventPayload({
  submissionId,
  assignmentId,
  userId,
  provider,
  reason,
  errorCode,
  safeErrorCategory,
  safeErrorMessage,
}: {
  submissionId: string;
  assignmentId: string;
  userId: string;
  provider: string;
  reason: string;
  errorCode?: string;
  safeErrorCategory?: string;
  safeErrorMessage?: string;
}) {
  const classification = errorCode && safeErrorCategory
    ? { errorCode, safeErrorCategory }
    : classifyGradingError(reason);

  return {
    submission_id: submissionId,
    assignment_id: assignmentId,
    user_id: userId,
    provider,
    error_code: classification.errorCode,
    error_message: safeErrorMessage ?? toSafeGradingErrorMessage(reason),
    safe_error_category: classification.safeErrorCategory,
  };
}
