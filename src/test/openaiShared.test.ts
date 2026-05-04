import { describe, expect, it } from "vitest";

import { parseAIResponse, parseJsonText } from "../../supabase/functions/_shared/openai";

describe("shared OpenAI helpers", () => {
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
});
