import type { AIResponse, AIResponseCriterion } from "@/types";

const OPENAI_API_URL = "https://api.openai.com/v1";

function getOpenAIApiKey() {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
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

export function getModel(envName: string, fallback: string) {
  return Deno.env.get(envName) || fallback;
}

export async function createResponse(body: Record<string, unknown>) {
  const response = await fetch(`${OPENAI_API_URL}/responses`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI responses error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

export async function createChatCompletion(body: Record<string, unknown>) {
  const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  return response;
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
  return JSON.parse((fenced?.[1] || trimmed).trim());
}

export function parseAIResponse(response: unknown): AIResponse {
  if (!isRecord(response)) {
    throw new Error("AI grading failed due to invalid response format");
  }

  const choices = response.choices;
  const firstChoice = Array.isArray(choices) ? choices[0] : null;
  const message = isRecord(firstChoice) && isRecord(firstChoice.message) ? firstChoice.message : null;
  const rawContent = typeof message?.content === "string" ? message.content : null;

  let parsed: unknown;

  try {
    parsed = rawContent ? JSON.parse(rawContent) : null;
  } catch {
    throw new Error("AI grading failed due to invalid response format");
  }

  if (!isAIResponse(parsed)) {
    throw new Error("AI grading failed due to invalid response format");
  }

  return parsed as AIResponse;
}
