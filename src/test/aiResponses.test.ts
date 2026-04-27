import { describe, expect, it } from "vitest";

import {
  safeParseExplanationResponse,
  safeParseAIGradeResponse,
  safeParseEdgeAIGradeResponse,
  safeParseGradeBreakdown,
  safeParseIntegrityBatchResponse,
  safeParseIntegrityResponse,
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

  it("accepts a valid explanation response", () => {
    const result = safeParseExplanationResponse({
      explanation: "Your argument is clear but needs more evidence.",
      guidance: "Use two more peer-reviewed sources.",
      next_steps: ["Review the rubric", "Rewrite the evidence paragraph"],
      criteria: [{ name: "Evidence", feedback: "Needs more cited support" }],
      confidence: 0.74,
    });

    expect(result.success).toBe(true);
    expect(result.data?.next_steps).toEqual([
      "Review the rubric",
      "Rewrite the evidence paragraph",
    ]);
  });

  it("rejects an invalid explanation response", () => {
    const result = safeParseExplanationResponse({
      explanation: 42,
      next_steps: "fix paragraph two",
    });

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
  });

  it("accepts a valid normalized integrity response", () => {
    const result = safeParseIntegrityResponse({
      similarity_score: 48,
      uncited_overlap: 22,
      cited_overlap: 9,
      risk_level: "medium",
      matches: [{ source: "Peer submission", percentage: 48, type: "internal" }],
      analysis_limited: false,
    });

    expect(result.success).toBe(true);
    expect(result.data?.risk_level).toBe("medium");
  });

  it("rejects an invalid normalized integrity response", () => {
    const result = safeParseIntegrityResponse({
      similarity_score: 140,
      matches: [{ source: "Web", percentage: "high" }],
    });

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
  });

  it("accepts the current plagiarism batch response shape", () => {
    const result = safeParseIntegrityBatchResponse({
      flags: [
        {
          submission_a_id: "sub-a",
          submission_b_id: "sub-b",
          student_a: "Sam Student",
          student_b: "Alex Student",
          similarity_score: 61,
          ai_suspicion_score: 14,
          baseline_deviation_score: 8,
          total_risk_score: 67,
          reason: "High uncited overlap",
          evidence_summary: "Large overlap in uncited sections.",
          overlap_analysis: {
            total_overlap: 61,
            cited_overlap: 10,
            uncited_overlap: 51,
            internal_peer_overlap: 61,
            external_source_overlap: 0,
          },
          recommended_action: "review",
          integrity_type: "similarity",
          severity: "high",
        },
      ],
      summary: "1 potential integrity issue found.",
      warnings: ["AI writing analysis skipped for one file."],
    });

    expect(result.success).toBe(true);
    expect(result.data?.flags).toHaveLength(1);
  });

  it("rejects malformed plagiarism batch responses without partial data", () => {
    const result = safeParseIntegrityBatchResponse({
      flags: [
        {
          student_a: "Sam Student",
          student_b: "Alex Student",
          similarity_score: "61",
          reason: "High uncited overlap",
          severity: "high",
        },
      ],
      summary: "1 potential integrity issue found.",
    });

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
  });
});
