import { getModel, openAiRequest } from "../_shared/openai.ts";

const SMOKE_TEST_PROMPT = "Reply with exactly: OK";
const SMOKE_SECRET_HEADER = "x-openai-smoke-secret";
const SAFE_MODEL_LABEL = "configured_grading_model";

type SmokeResponse = {
  ok: boolean;
  timed_out: boolean;
  status_code: number | null;
  duration_ms: number;
  response_received: boolean;
  safe_error_category: string | null;
  model_label: string;
};

function getEnv(name: string) {
  if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    return Deno.env.get(name);
  }

  if (typeof process !== "undefined" && process.env) {
    return process.env[name];
  }

  return undefined;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createMethodNotAllowedResponse() {
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: {
      "Content-Type": "application/json",
      Allow: "POST",
    },
  });
}

function createUnauthorizedResponse(message: string, status = 401) {
  return jsonResponse({ error: message }, status);
}

function classifySafeErrorCategory(status: number) {
  if (status === 401 || status === 403) return "auth_error";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_error";
  return "provider_error";
}

function buildSmokeRequestBody() {
  const model = getModel("OPENAI_GRADING_MODEL", "gpt-4o-mini");

  return {
    model,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: SMOKE_TEST_PROMPT }],
      },
    ],
    max_output_tokens: 5,
  } satisfies Record<string, unknown>;
}

export async function runOpenAISmokeTest(): Promise<SmokeResponse> {
  const startedAt = performance.now();
  const modelLabel = SAFE_MODEL_LABEL;

  try {
    const response = await openAiRequest("/responses", buildSmokeRequestBody());
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));

    return {
      ok: response.ok,
      timed_out: false,
      status_code: response.status,
      duration_ms: durationMs,
      response_received: true,
      safe_error_category: response.ok ? null : classifySafeErrorCategory(response.status),
      model_label: modelLabel,
    };
  } catch (error) {
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
    const timedOut = error instanceof Error && /timed out/i.test(error.message);

    return {
      ok: false,
      timed_out: timedOut,
      status_code: null,
      duration_ms: durationMs,
      response_received: false,
      safe_error_category: timedOut ? "service_failure" : "network_error",
      model_label: modelLabel,
    };
  }
}

function validateSmokeSecret(req: Request) {
  if (req.method !== "POST") {
    return createMethodNotAllowedResponse();
  }

  const configuredSecret = getEnv("OPENAI_SMOKE_TEST_SECRET");
  if (!configuredSecret) {
    return createUnauthorizedResponse("Smoke test secret is not configured", 500);
  }

  const providedSecret = req.headers.get(SMOKE_SECRET_HEADER);
  if (!providedSecret) {
    return createUnauthorizedResponse("Missing smoke test secret", 401);
  }

  if (providedSecret !== configuredSecret) {
    return createUnauthorizedResponse("Invalid smoke test secret", 403);
  }

  return null;
}

export async function handleOpenAISmokeTestRequest(req: Request) {
  const secretError = validateSmokeSecret(req);
  if (secretError) return secretError;

  const result = await runOpenAISmokeTest();
  return jsonResponse(result);
}
