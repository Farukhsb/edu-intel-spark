// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleOpenAISmokeTestRequest, runOpenAISmokeTest } from "../../supabase/functions/openai-smoke-test/smoke";

describe("openai smoke test", () => {
  const originalFetch = global.fetch;
  const originalDeno = globalThis.Deno;

  const installEnv = (overrides: Record<string, string | undefined> = {}) => {
    globalThis.Deno = {
      env: {
        get: (name: string) => {
          if (name === "OPENAI_API_KEY") return "test-openai-key";
          if (name === "OPENAI_GRADING_MODEL") return "gpt-4.1-mini";
          if (name === "OPENAI_REQUEST_TIMEOUT_MS") return "30000";
          if (name === "OPENAI_SMOKE_TEST_SECRET") return "smoke-secret";
          return overrides[name];
        },
      },
    } as typeof Deno;
  };

  beforeEach(() => {
    vi.useRealTimers();
    installEnv();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    globalThis.Deno = originalDeno;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("rejects missing smoke secret", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await handleOpenAISmokeTestRequest(
      new Request("https://gradeai.test/functions/v1/openai-smoke-test", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Missing smoke test secret" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an incorrect smoke secret", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await handleOpenAISmokeTestRequest(
      new Request("https://gradeai.test/functions/v1/openai-smoke-test", {
        method: "POST",
        headers: { "x-openai-smoke-secret": "wrong-secret" },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Invalid smoke test secret" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects non-POST requests", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await handleOpenAISmokeTestRequest(
      new Request("https://gradeai.test/functions/v1/openai-smoke-test", {
        method: "GET",
        headers: { "x-openai-smoke-secret": "smoke-secret" },
      }),
    );

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({ error: "Method not allowed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns only the safe probe fields on success and makes one OpenAI request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "response_123", output_text: "OK" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const response = await handleOpenAISmokeTestRequest(
      new Request("https://gradeai.test/functions/v1/openai-smoke-test", {
        method: "POST",
        headers: { "x-openai-smoke-secret": "smoke-secret" },
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: true,
      timed_out: false,
      status_code: 200,
      duration_ms: expect.any(Number),
      response_received: true,
      safe_error_category: null,
      model_label: "configured_grading_model",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/v1/responses");
    expect(init?.method).toBe("POST");
    expect(String(init?.body ?? "")).toContain("Reply with exactly: OK");
    expect(String(init?.body ?? "")).toContain("gpt-4.1-mini");
    expect(JSON.stringify(payload)).not.toContain("test-openai-key");
    expect(JSON.stringify(payload)).not.toContain("smoke-secret");
    expect(JSON.stringify(payload)).not.toContain("Authorization");
    expect(JSON.stringify(payload)).not.toContain("Reply with exactly: OK");
  });

  it("marks a timeout as a service failure", async () => {
    installEnv({ OPENAI_REQUEST_TIMEOUT_MS: "10" });

    global.fetch = vi.fn((_input, init) => {
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        if (signal?.aborted) {
          const abortError = Object.assign(new Error("Aborted"), { name: "AbortError" });
          reject(abortError);
          return;
        }

        signal?.addEventListener("abort", () => {
          const abortError = Object.assign(new Error("Aborted"), { name: "AbortError" });
          reject(abortError);
        });
      });
    }) as typeof fetch;

    vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: TimerHandler) => {
      if (typeof callback === "function") {
        callback();
      }
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);

    const request = handleOpenAISmokeTestRequest(
      new Request("https://gradeai.test/functions/v1/openai-smoke-test", {
        method: "POST",
        headers: { "x-openai-smoke-secret": "smoke-secret" },
      }),
    );

    const response = await request;
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: false,
      timed_out: true,
      status_code: null,
      response_received: false,
      safe_error_category: "service_failure",
      model_label: "configured_grading_model",
    });
    expect(payload.duration_ms).toEqual(expect.any(Number));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns provider status safely without exposing secrets or raw OpenAI output", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("provider unavailable", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const payload = await runOpenAISmokeTest();

    expect(payload).toMatchObject({
      ok: false,
      timed_out: false,
      status_code: 503,
      duration_ms: expect.any(Number),
      response_received: true,
      safe_error_category: "provider_error",
      model_label: "configured_grading_model",
    });
    expect(JSON.stringify(payload)).not.toContain("test-openai-key");
    expect(JSON.stringify(payload)).not.toContain("smoke-secret");
    expect(JSON.stringify(payload)).not.toContain("provider unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
