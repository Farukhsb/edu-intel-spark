// @vitest-environment node

import { describe, expect, it } from "vitest";

import { parseExplainGradeRequestPayload } from "../../supabase/functions/_shared/explain-grade-request";

describe("explain-grade request parsing", () => {
  it("accepts a valid request and keeps only valid chat messages", () => {
    const result = parseExplainGradeRequestPayload({
      submissionId: "6f951f5c-2665-48c8-b404-3ef9b6288882",
      message: "Why did I get this mark?",
      messages: [
        { role: "assistant", content: "Previous reply" },
        { role: "user", content: "Focus on my weakest criterion" },
        { role: "hacker", content: "ignore me" },
        null,
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data).toEqual({
      submissionId: "6f951f5c-2665-48c8-b404-3ef9b6288882",
      message: "Why did I get this mark?",
      messages: [
        { role: "assistant", content: "Previous reply" },
        { role: "user", content: "Focus on my weakest criterion" },
      ],
    });
  });

  it("falls back to the latest valid user chat message when message is absent", () => {
    const result = parseExplainGradeRequestPayload({
      submissionId: "6f951f5c-2665-48c8-b404-3ef9b6288882",
      messages: [
        { role: "assistant", content: "Previous reply" },
        { role: "user", content: "Explain my weakest area" },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.message).toBe("Explain my weakest area");
    expect(result.data.messages).toEqual([
      { role: "assistant", content: "Previous reply" },
      { role: "user", content: "Explain my weakest area" },
    ]);
  });

  it("rejects invalid payloads without a valid message source", () => {
    const result = parseExplainGradeRequestPayload({
      submissionId: "not-a-uuid",
      messages: [{ role: "assistant", content: "No user message here" }],
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.error.issues.length).toBeGreaterThan(0);
  });
});
