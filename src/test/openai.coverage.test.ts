import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

vi.stubGlobal("fetch", mocks.fetch);

describe("shared OpenAI helpers coverage", () => {
  const originalDeno = globalThis.Deno;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    globalThis.Deno = {
      env: {
        get: (name: string) => {
          if (name === "OPENAI_API_KEY") return "test-openai-key";
          if (name === "OPENAI_REQUEST_TIMEOUT_MS") return "25";
          return undefined;
        },
      },
    } as typeof Deno;
  });

  afterEach(() => {
    globalThis.Deno = originalDeno;
    vi.useRealTimers();
  });

  it("parses outputs and validates AI responses", async () => {
    const openai = await import("../../supabase/functions/_shared/openai");

    expect(openai.getModel("OPENAI_CHAT_MODEL", "fallback-model")).toBe("fallback-model");
    expect(openai.extractOutputText({ output_text: "Primary output" })).toBe("Primary output");
    expect(
      openai.extractOutputText({
        output: [
          {
            type: "message",
            content: [
              { type: "output_text", text: "Part one" },
              { type: "output_text", text: "Part two" },
            ],
          },
        ],
      }),
    ).toBe("Part one\nPart two");
    expect(openai.extractOutputText(null)).toBe("");

    expect(openai.isAIResponse({
      total_score: 72,
      overall_feedback: "Good",
      confidence_score: 0.8,
      criteria: [
        {
          criterion_name: "Analysis",
          awarded_score: 18,
          max_score: 25,
          reason_for_score: "Good effort",
          evidence_from_submission: ["Paragraph 1"],
          confidence_score: 0.9,
        },
      ],
    })).toBe(true);
    expect(openai.isAIResponse({ total_score: "72", overall_feedback: "Good", criteria: [] })).toBe(false);

    expect(
      openai.parseAIResponse({
        choices: [
          {
            message: {
              content: "```json\n{\"total_score\":72,\"overall_feedback\":\"Good\",\"confidence_score\":0.8,\"criteria\":[{\"criterion_name\":\"Analysis\",\"awarded_score\":18,\"max_score\":25,\"reason_for_score\":\"Good effort\",\"evidence_from_submission\":[\"Paragraph 1\"],\"confidence_score\":0.9}]}\n```",
            },
          },
        ],
      }),
    ).toMatchObject({
      total_score: 72,
      overall_feedback: "Good",
      criteria: [{ criterion_name: "Analysis" }],
    });

    expect(() => openai.parseAIResponse({ choices: [] })).toThrow("AI grading failed due to invalid response format");
    expect(() => openai.parseJsonText("not-json")).toThrow("OpenAI returned invalid JSON content");
  });

  it("times out requests and reports non-ok responses", async () => {
    const openai = await import("../../supabase/functions/_shared/openai");

    vi.useFakeTimers();
    mocks.fetch.mockImplementation((_input, init) => {
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
        });
      });
    });

    const timeoutPromise = expect(
      openai.createChatCompletion({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Explain this grade" }],
      }),
    ).rejects.toThrow("OpenAI grading request timed out after 25ms. Retry the submission or try again later.");

    await vi.advanceTimersByTimeAsync(25);
    await timeoutPromise;

    mocks.fetch.mockResolvedValueOnce(
      new Response("bad request", {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      }),
    );

    await expect(
      openai.createResponse({
        model: "gpt-4o-mini",
        input: "Explain this grade",
      }),
    ).rejects.toThrow("OpenAI responses error (400): bad request");

    expect(mocks.fetch).toHaveBeenCalled();
  });
});
