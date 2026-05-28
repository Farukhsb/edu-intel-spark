import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createChatCompletion, createResponse, parseAIResponse, parseJsonText } from "../../supabase/functions/_shared/openai";

describe("shared OpenAI helpers", () => {
  const originalFetch = global.fetch;
  const originalDeno = globalThis.Deno;

  beforeEach(() => {
    vi.useRealTimers();
    globalThis.Deno = {
      env: {
        get: (name: string) => {
          if (name === "OPENAI_API_KEY") return "test-openai-key";
          if (name === "OPENAI_REQUEST_TIMEOUT_MS") return "30000";
          if (name === "OPENAI_CHAT_MODEL") return "gpt-4o-mini";
          if (name === "OPENAI_GRADING_MODEL") return "gpt-4.1-mini";
          return undefined;
        },
      },
    } as typeof Deno;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    globalThis.Deno = originalDeno;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("parses fenced JSON content", () => {
    expect(parseJsonText("```json\n{\"score\": 72}\n```")).toEqual({ score: 72 });
  });

  it("throws a controlled error for invalid JSON text", () => {
    expect(() => parseJsonText("{score:72}")).toThrow("OpenAI returned invalid JSON content");
  });

  it("parses a valid chat completion grading payload", () => {
    const result = parseAIResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              total_score: 68,
              overall_feedback: "Clear structure with limited critical depth.",
              confidence_score: 0.81,
              criteria: [
                {
                  criterion_name: "Analysis",
                  awarded_score: 18,
                  max_score: 25,
                  reason_for_score: "Reasonable but underdeveloped argument.",
                  evidence_from_submission: ["Paragraph 2 weighs both sides briefly."],
                  confidence_score: 0.8,
                },
              ],
            }),
          },
        },
      ],
    });

    expect(result.total_score).toBe(68);
    expect(result.criteria).toHaveLength(1);
  });

  it("rejects malformed chat completion grading payloads", () => {
    expect(() =>
      parseAIResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                total_score: "68",
                overall_feedback: "Unsafe payload",
                confidence_score: 0.81,
                criteria: [],
              }),
            },
          },
        ],
      }),
    ).toThrow("AI grading failed due to invalid response format");
  });

  it("fails fast when the responses API call times out", async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn((_input, init) => {
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          const abortError = Object.assign(new Error("Aborted"), { name: "AbortError" });
          reject(abortError);
        });
      });
    }) as typeof fetch;

    const request = expect(
      createResponse({
        model: "gpt-4o-mini",
        input: "Explain this grade",
      }),
    ).rejects.toThrow("OpenAI grading request timed out after 30000ms. Retry the submission or try again later.");

    await vi.advanceTimersByTimeAsync(30_000);

    await request;
  });

  it("fails fast when the chat completions API call times out", async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn((_input, init) => {
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          const abortError = Object.assign(new Error("Aborted"), { name: "AbortError" });
          reject(abortError);
        });
      });
    }) as typeof fetch;

    const request = expect(
      createChatCompletion({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Explain this grade" }],
      }),
    ).rejects.toThrow("OpenAI grading request timed out after 30000ms. Retry the submission or try again later.");

    await vi.advanceTimersByTimeAsync(30_000);

    await request;
  });

  it("throws the provider error for non-success responses API calls", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("bad request", {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      }),
    ) as typeof fetch;

    await expect(
      createResponse({
        model: "gpt-4o-mini",
        input: "Explain this grade",
      }),
    ).rejects.toThrow("OpenAI responses error (400): bad request");

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
