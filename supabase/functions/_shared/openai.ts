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

export function extractOutputText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const textParts = (data?.output || [])
    .filter((item: any) => item?.type === "message")
    .flatMap((item: any) => item?.content || [])
    .filter((part: any) => part?.type === "output_text" && typeof part?.text === "string")
    .map((part: any) => part.text);

  return textParts.join("\n").trim();
}

export function parseJsonText(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse((fenced?.[1] || trimmed).trim());
}
