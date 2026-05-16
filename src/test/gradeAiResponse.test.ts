// @vitest-environment node

import { describe, expect, it } from "vitest";

import { safeParseGradeAIResponse } from "../../supabase/functions/_shared/grade-ai-response";

describe("grade AI response parsing", () => {
  it("accepts the current grading edge response shape", () => {
    const result = safeParseGradeAIResponse({
      total_score: 72,
      overall_feedback: "Solid answer with room for deeper analysis.",
      main_strengths: ["Structure"],
      main_weaknesses: ["Depth"],
      confidence_score: 0.81,
      lecturer_review_required: false,
      review_reasons: ["Borderline criterion confidence"],
      criteria: [
        {
          criterion: "Analysis",
          score: 28,
          max_score: 40,
          reason_for_score: "Reasonable analysis with some missing depth.",
          confidence_score: 0.78,
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.total_score).toBe(72);
    expect(result.data.criteria).toHaveLength(1);
    expect(result.data.criteria?.[0].criterion).toBe("Analysis");
  });

  it("accepts fallback feedback/score fields and breakdown arrays", () => {
    const result = safeParseGradeAIResponse({
      score: 66,
      feedback: "Competent answer with missing depth.",
      grading_confidence: 0.64,
      breakdown: [
        {
          name: "Knowledge",
          awarded_score: 16,
          max_score: 25,
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.score).toBe(66);
    expect(result.data.breakdown?.[0].name).toBe("Knowledge");
  });

  it("rejects malformed grading payloads without a valid score or breakdown", () => {
    const result = safeParseGradeAIResponse({
      total_score: "72",
      overall_feedback: "Unsafe payload",
      criteria: ["bad"],
    });

    expect(result.success).toBe(false);
  });
});
