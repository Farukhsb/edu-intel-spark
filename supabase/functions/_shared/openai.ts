import type { AIResponse, AIResponseCriterion } from "@/types";
import { z } from "npm:zod";

const OPENAI_API_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_TIMEOUT_MS = 30_000;

const AIResponseCriterionSchema: z.ZodType<AIResponseCriterion> = z
  .object({
    criterion_name: z.string(),
    awarded_score: z.number(),
    max_score: z.number(),
    reason_for_score: z.string(),
    evidence_from_submission: z.array(z.string()),
    confidence_score: z.number(),
    performance_band: z.string().nullable().optional(),
    rubric_expectation: z.string().nullable().optional(),
    improvement_actions: z.array(z.string()).nullable().optional(),
    error_type: z.enum(["arithmetic_slip", "conceptual_flaw", "none"]).optional(),
  })
  .passthrough();

const AIResponseSchema: z.ZodType<AIResponse> = z
  .object({
    total_score: z.number(),
    overall_feedback: z.string(),
    confidence_score: z.number(),
    lecturer_review_required: z.boolean().optional(),
    criteria: z.array(AIResponseCriterionSchema),
    math_analysis: z
      .object({
        detected: z.boolean(),
        summary: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

function getOpenAIApiKey() {
  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  return apiKey;
}

function getHeaders() {
  return {
    Authorization: `Bearer ${getOpenAIApiKey()}`,
    "Content-Type": "application/json",
  };
}

function getOpenAITimeoutMs() {
  const configured = Number(getEnv("OPENAI_REQUEST_TIMEOUT_MS") || DEFAULT_OPENAI_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_OPENAI_TIMEOUT_MS;
  }

  return configured;
}

function getEnv(name: string) {
  if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    return Deno.env.get(name);
  }

  if (typeof process !== "undefined" && process.env) {
    return process.env[name];
  }

  return undefined;
}
async function openAiFetch(path: string, body: Record<string, unknown>) {
  const timeoutMs = getOpenAITimeoutMs();
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(`${OPENAI_API_URL}${path}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`OpenAI request timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export function getModel(envName: string, fallback: string) {
  return getEnv(envName) || fallback;
}

export async function createResponse(body: Record<string, unknown>) {
  const response = await openAiFetch("/responses", body);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI responses error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

export async function createChatCompletion(body: Record<string, unknown>) {
  return await openAiFetch("/chat/completions", body);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAIResponseCriterion(value: unknown): value is AIResponseCriterion {
  if (!isRecord(value)) return false;

  return (
    typeof value.criterion_name === "string" &&
    typeof value.awarded_score === "number" &&
    typeof value.max_score === "number" &&
    typeof value.reason_for_score === "string" &&
    Array.isArray(value.evidence_from_submission) &&
    typeof value.confidence_score === "number"
  );
}

export function isAIResponse(obj: unknown): obj is AIResponse {
  if (!isRecord(obj)) return false;

  const criteria = obj.criteria;

  return (
    typeof obj.total_score === "number" &&
    typeof obj.overall_feedback === "string" &&
    Array.isArray(criteria) &&
    criteria.every((criterion) => isAIResponseCriterion(criterion))
  );
}

export function extractOutputText(data: unknown): string {
  if (!isRecord(data)) return "";

  const outputText = data.output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return outputText;
  }

  const output = Array.isArray(data.output) ? data.output : [];

  const textParts = output
    .filter((item): item is Record<string, unknown> => isRecord(item) && item.type === "message")
    .flatMap((item) => {
      const content = item.content;
      return Array.isArray(content) ? content : [];
    })
    .filter((part): part is Record<string, unknown> => isRecord(part) && part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text as string);

  return textParts.join("\n").trim();
}

export function parseJsonText(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || trimmed).trim();

  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error("OpenAI returned invalid JSON content");
  }
}

export function parseAIResponse(response: unknown): AIResponse {
  if (!isRecord(response)) {
    throw new Error("AI grading failed due to invalid response format");
  }

  const choices = response.choices;
  const firstChoice = Array.isArray(choices) ? choices[0] : null;
  const message = isRecord(firstChoice) && isRecord(firstChoice.message) ? firstChoice.message : null;
  const rawContent = typeof message?.content === "string" ? message.content : null;

  try {
    const parsed = rawContent ? parseJsonText(rawContent) : null;
    return AIResponseSchema.parse(parsed);
  } catch {
    throw new Error("AI grading failed due to invalid response format");
  }
}
