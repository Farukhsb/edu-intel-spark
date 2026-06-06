// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

const { createResponseMock } = vi.hoisted(() => ({
  createResponseMock: vi.fn(),
}));

vi.mock("../../supabase/functions/_shared/openai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../supabase/functions/_shared/openai")>();

  return {
    ...actual,
    createResponse: createResponseMock,
  };
});

import { requestStructuredGrade } from "../../supabase/functions/grade-submission/prompting";

describe("grade-submission prompting guardrails", () => {
  it("fails closed when the provider returns invalid JSON", async () => {
    createResponseMock.mockResolvedValueOnce({
      output_text: "{not valid json}",
    });

    await expect(
      requestStructuredGrade({
        gradingModel: "gpt-test-model",
        systemPrompt: "system",
        prompt: "prompt",
        rubricLength: 1,
        isMathMode: false,
      }),
    ).rejects.toThrow("AI provider returned an invalid or incomplete JSON response.");
  });

  it("fails closed when the provider request is aborted or times out", async () => {
    createResponseMock.mockRejectedValueOnce(new Error("Aborted"));

    await expect(
      requestStructuredGrade({
        gradingModel: "gpt-test-model",
        systemPrompt: "system",
        prompt: "prompt",
        rubricLength: 1,
        isMathMode: false,
      }),
    ).rejects.toThrow("AI provider request timed out.");
  });
});
