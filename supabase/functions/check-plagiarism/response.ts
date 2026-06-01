import { createResponse, extractOutputText, parseJsonText } from "../_shared/openai.ts";
import { logWarn } from "../_shared/log.ts";
import { OPENAI_RETRY_ATTEMPTS, sleep } from "./analysis.ts";

export async function createIntegrityResponseWithRetry(body: Record<string, unknown>) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= OPENAI_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await createResponse(body);
    } catch (error) {
      lastError = error;
      logWarn("check-plagiarism OpenAI attempt failed", {
        attempt,
      });
      if (attempt < OPENAI_RETRY_ATTEMPTS) {
        await sleep(250 * attempt);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Integrity analysis request failed");
}

export function parseIntegrityResponse(aiData: unknown) {
  return parseJsonText(extractOutputText(aiData as never));
}

export function categorizeIntegrityWarnings(warnings: string[]) {
  const categories = {
    extraction: 0,
    accessibility: 0,
    ai: 0,
    persistence: 0,
    cohort: 0,
    baseline: 0,
    other: 0,
  };

  for (const warning of warnings) {
    const normalized = warning.toLowerCase();

    if (
      normalized.includes("extraction") ||
      normalized.includes("readable text") ||
      normalized.includes("pdf")
    ) {
      categories.extraction += 1;
    } else if (normalized.includes("accessible")) {
      categories.accessibility += 1;
    } else if (normalized.includes("ai similarity analysis")) {
      categories.ai += 1;
    } else if (
      normalized.includes("could not be stored") ||
      normalized.includes("could not be updated")
    ) {
      categories.persistence += 1;
    } else if (
      normalized.includes("cohort") ||
      normalized.includes("pairwise") ||
      normalized.includes("skipped")
    ) {
      categories.cohort += 1;
    } else if (normalized.includes("writing profile") || normalized.includes("review history")) {
      categories.baseline += 1;
    } else {
      categories.other += 1;
    }
  }

  return categories;
}
