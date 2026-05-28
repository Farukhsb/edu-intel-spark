import { getModel, openAiRequest } from "../_shared/openai.ts";

const SMOKE_TEST_PROMPT = "Reply with exactly: OK";
const SMOKE_MAX_OUTPUT_TOKENS = 64;
const SMOKE_SECRET_HEADER = "x-openai-smoke-secret";
const SAFE_MODEL_LABEL = "configured_grading_model";

type SmokeResponse = {
  ok: boolean;
  timed_out: boolean;
  status_code: number | null;
  duration_ms: number;
  response_received: boolean;
  safe_error_category: string | null;
  provider_error_type: string | null;
  provider_error_code: string | null;
  provider_error_param: string | null;
  provider_error_classification:
    | "model_not_found"
    | "model_not_supported_for_endpoint"
    | "unsupported_parameter"
    | "invalid_request_shape"
    | "auth_error"
    | "rate_limited"
    | "quota_or_billing"
    | "provider_error"
    | "unknown"
    | null;
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

type ProviderErrorBody = {
  error?: {
    type?: unknown;
    code?: unknown;
    param?: unknown;
    message?: unknown;
  };
};

type ProviderErrorClassification =
  | "model_not_found"
  | "model_not_supported_for_endpoint"
  | "unsupported_parameter"
  | "invalid_request_shape"
  | "auth_error"
  | "rate_limited"
  | "quota_or_billing"
  | "provider_error"
  | "unknown";

function safeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function parseProviderErrorBody(bodyText: string) {
  try {
    const parsed = JSON.parse(bodyText) as ProviderErrorBody;
    const error = parsed?.error ?? {};

    return {
      provider_error_type: safeString(error.type),
      provider_error_code: safeString(error.code),
      provider_error_param: safeString(error.param),
      provider_error_message: safeString(error.message),
    };
  } catch {
    return {
      provider_error_type: null,
      provider_error_code: null,
      provider_error_param: null,
      provider_error_message: null,
    };
  }
}

function classifyProviderError(params: {
  status: number;
  providerErrorType: string | null;
  providerErrorCode: string | null;
  providerErrorParam: string | null;
  providerErrorMessage: string | null;
}): ProviderErrorClassification {
  const { status, providerErrorType, providerErrorCode, providerErrorParam, providerErrorMessage } = params;
  const normalizedCode = providerErrorCode?.toLowerCase() ?? "";
  const normalizedType = providerErrorType?.toLowerCase() ?? "";
  const normalizedMessage = providerErrorMessage?.toLowerCase() ?? "";
  const normalizedParam = providerErrorParam?.toLowerCase() ?? "";

  if (status === 401 || status === 403) return "auth_error";
  if (status === 429 || normalizedCode === "rate_limit_exceeded" || normalizedCode === "insufficient_quota") {
    return normalizedCode === "insufficient_quota" ? "quota_or_billing" : "rate_limited";
  }

  if (
    normalizedCode === "model_not_found" ||
    normalizedMessage.includes("model_not_found") ||
    (normalizedMessage.includes("model") && normalizedMessage.includes("not found"))
  ) {
    return "model_not_found";
  }

  if (
    normalizedMessage.includes("does not support this endpoint") ||
    normalizedMessage.includes("not supported for this endpoint") ||
    normalizedMessage.includes("does not support responses") ||
    normalizedMessage.includes("unsupported endpoint") ||
    normalizedCode === "unsupported_model" ||
    (normalizedType === "invalid_request_error" &&
      normalizedMessage.includes("endpoint") &&
      normalizedMessage.includes("support"))
  ) {
    return "model_not_supported_for_endpoint";
  }

  if (
    normalizedCode === "unsupported_parameter" ||
    normalizedParam.length > 0 ||
    normalizedMessage.includes("unsupported parameter") ||
    normalizedMessage.includes("parameter is not supported")
  ) {
    return "unsupported_parameter";
  }

  if (
    normalizedType === "invalid_request_error" ||
    normalizedCode === "invalid_request_error" ||
    normalizedMessage.includes("invalid request") ||
    normalizedMessage.includes("missing required") ||
    normalizedMessage.includes("unknown field")
  ) {
    return "invalid_request_shape";
  }

  if (normalizedCode === "insufficient_quota" || normalizedMessage.includes("quota") || normalizedMessage.includes("billing")) {
    return "quota_or_billing";
  }

  if (status >= 500) return "provider_error";
  return "unknown";
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
    max_output_tokens: SMOKE_MAX_OUTPUT_TOKENS,
  } satisfies Record<string, unknown>;
}

export async function runOpenAISmokeTest(): Promise<SmokeResponse> {
  const startedAt = performance.now();
  const modelLabel = SAFE_MODEL_LABEL;

  try {
    const response = await openAiRequest("/responses", buildSmokeRequestBody());
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
    let providerErrorType: string | null = null;
    let providerErrorCode: string | null = null;
    let providerErrorParam: string | null = null;
    let providerErrorClassification: ProviderErrorClassification | null = null;

    if (!response.ok) {
      const errorBody = parseProviderErrorBody(await response.text());
      providerErrorType = errorBody.provider_error_type;
      providerErrorCode = errorBody.provider_error_code;
      providerErrorParam = errorBody.provider_error_param;
      providerErrorClassification = classifyProviderError({
        status: response.status,
        providerErrorType,
        providerErrorCode,
        providerErrorParam,
        providerErrorMessage: errorBody.provider_error_message,
      });
    }

    return {
      ok: response.ok,
      timed_out: false,
      status_code: response.status,
      duration_ms: durationMs,
      response_received: true,
      safe_error_category: response.ok
        ? null
        : providerErrorClassification === "auth_error"
          ? "auth_error"
          : providerErrorClassification === "rate_limited"
            ? "rate_limited"
            : providerErrorClassification === "quota_or_billing"
              ? "provider_error"
              : "provider_error",
      provider_error_type: providerErrorType,
      provider_error_code: providerErrorCode,
      provider_error_param: providerErrorParam,
      provider_error_classification: providerErrorClassification,
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
      provider_error_type: null,
      provider_error_code: null,
      provider_error_param: null,
      provider_error_classification: null,
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
