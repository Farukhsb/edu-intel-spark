import { describe, expect, it } from "vitest";

import {
  safeParseAIGradeResponse,
  safeParseEdgeAIGradeResponse,
  safeParseGradeBreakdown,
} from "@/lib/schemas/aiResponses";

describe("aiResponses schemas", () => {
  it("accepts a valid stored AI grading payload", () => {
    const result = safeParseAIGradeResponse({
      final_score: 78,
      ai_feedback: "Strong structure and analysis.",
      grading_confidence: 0.82,
      ai_breakdown: [
        { criterion: "Analysis", score: 31, max_score: 40, feedback: "Clear reasoning" },
        { name: "Evidence", score: 22, maxScore: 30, comment: "Use more sources" },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.ai_score).toBe(78);
    expect(result.data.ai_breakdown[1].criterion).toBe("Evidence");
    expect(result.data.ai_breakdown[1].max_score).toBe(30);
  });

  it("accepts the current edge-function grading shape", () => {
    const result = safeParseEdgeAIGradeResponse({
      score: 66,
      feedback: "Competent answer with missing depth.",
      gradingConfidence: 0.64,
      breakdown: [
        { criterion: "Knowledge", score: 16, max_score: 25 },
        { name: "Argument", score: 17, maxScore: 25 },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.ai_score).toBe(66);
    expect(result.data.ai_breakdown).toHaveLength(2);
  });

  it("rejects malformed AI grading payloads", () => {
    const result = safeParseEdgeAIGradeResponse({
      score: "78",
      feedback: "Unsafe payload",
      breakdown: [{ criterion: "Analysis", score: 20 }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects malformed breakdown items instead of accepting partial data", () => {
    const result = safeParseGradeBreakdown([
      { criterion: "Analysis", score: 21, max_score: 25 },
      { score: 17, maxScore: 25 },
    ]);

    expect(result.success).toBe(false);
  });
});
