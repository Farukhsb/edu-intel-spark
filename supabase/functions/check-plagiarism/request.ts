import { z } from "npm:zod";
import type { createAdminClient, requireLecturer } from "../_shared/auth.ts";

export type CheckPlagiarismHandlerDeps = {
  createAdminClient: typeof createAdminClient;
  requireLecturer: typeof requireLecturer;
  jsonError: (error: unknown, corsHeaders: Record<string, string>) => Response;
  getCorsHeaders: (req: Request) => Record<string, string> | null;
  createCorsForbiddenResponse: () => Response;
  createIntegrityResponseWithRetry?: (
    body: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>;
};

export type AdminSupabaseClient = ReturnType<typeof createAdminClient>;

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const ExistingReviewNoteSchema = z.object({
  latestNote: z.string().catch(""),
  history: z.array(z.unknown()).catch([]),
});

export function readEnv(name: string) {
  if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    return Deno.env.get(name);
  }

  if (typeof process !== "undefined" && process.env) {
    return process.env[name];
  }

  return undefined;
}

export const MAX_SINGLE_TEXT_CHARS = 12000;
export const MAX_MULTI_TEXT_CHARS = 3500;
export const EXTRACTION_CONCURRENCY = 4;
export const LARGE_COHORT_WARNING_THRESHOLD = 30;
export const MAX_INTERNAL_COMPARISON_SUBMISSIONS = 80;
export const MAX_REQUESTED_SUBMISSION_IDS = 80;
export const OPENAI_RETRY_ATTEMPTS = 2;
export const MIN_INTEGRITY_FLAG_SCORE = 25;
export const INTERNAL_SIMILARITY_MIN_WORDS = 50;

export const CheckPlagiarismRequestSchema = z
  .object({
    submissionId: z.string().uuid().optional(),
    submissionIds: z.array(z.string().uuid()).max(MAX_REQUESTED_SUBMISSION_IDS).optional(),
    assignmentId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.assignmentId), {
    message: "assignmentId is required",
    path: ["assignmentId"],
  });

export const includeValidationDetails = readEnv("ENV") === "development";

export type IntegrityProviderMode = "llm_legacy" | "internal_text_similarity" | "both";

export function resolveIntegrityProviderMode(rawBody: Record<string, unknown> | null): IntegrityProviderMode {
  const envProvider = readEnv("INTEGRITY_PROVIDER_MODE")?.trim().toLowerCase() || "";
  if (envProvider === "llm_legacy" || envProvider === "internal_text_similarity" || envProvider === "both") {
    return envProvider;
  }
  return "both";
}

export type MossRunnerConfig = {
  runnerUrl: string;
  apiKey: string | null;
  timeoutMs: number;
};

export function resolveMossRunnerConfig(): MossRunnerConfig | null {
  const isEnabled = readEnv("MOSS_PROVIDER_ENABLED")?.trim().toLowerCase() === "true";
  if (!isEnabled) return null;

  const runnerUrl = readEnv("MOSS_RUNNER_URL")?.trim() || "";
  if (!runnerUrl) {
    return null;
  }

  const timeoutMs = Number(readEnv("MOSS_RUNNER_TIMEOUT_MS") || "20000");

  return {
    runnerUrl,
    apiKey: readEnv("MOSS_RUNNER_API_SECRET")?.trim() || null,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 20_000,
  };
}
