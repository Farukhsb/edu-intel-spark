// @vitest-environment node

import { describe, expect, it } from "vitest";

import { applyCriterionBandFloorRecalibration } from "../../supabase/functions/grade-submission/fairness-support";
import type { GradeBreakdownItem } from "../../supabase/functions/grade-submission/grading-support";

function buildItem(overrides: Partial<GradeBreakdownItem>): GradeBreakdownItem {
  return {
    criterion: "Criterion",
    score: 10,
    max_score: 20,
    performance_band: "Satisfactory",
    comment: "No criterion-specific comment provided.",
    evidence_snippet: "Evidence",
    rubric_expectation: "Expectation",
    evidence_from_submission: "Relevant evidence from submission.",
    reason_for_score: "No criterion-specific comment provided.",
    improvement_feedback: "Improve this criterion.",
    strengths: [],
    weaknesses: [],
    confidence_score: 0.82,
    review_required: false,
    error_type: "none",
    ...overrides,
  };
}

describe("grading fairness support", () => {
  it("lifts multi-criterion scores when criterion feedback describes good concise work", () => {
    const result = applyCriterionBandFloorRecalibration({
      breakdown: [
        buildItem({
          criterion: "Keys and integrity constraints",
          score: 10,
          max_score: 20,
          performance_band: "Satisfactory",
          comment: "The answer is good, correct, and logically identifies the key constraints.",
          reason_for_score: "Good concise reasoning with correct key and foreign-key relationships.",
          strengths: ["Clear trade-off rationale"],
        }),
        buildItem({
          criterion: "Justification and trade-offs",
          score: 12,
          max_score: 20,
          performance_band: "Satisfactory",
          comment: "Solid and defensible trade-off explanation.",
          reason_for_score: "Strong concise justification with appropriate trade-off discussion.",
        }),
      ],
      extractionSuccess: true,
      extractedTextLength: 520,
    });

    expect(result.changed).toBe(true);
    expect(result.total).toBe(28);
    expect(result.breakdown[0].score).toBe(14);
    expect(result.breakdown[1].score).toBe(14);
    expect(result.breakdown[0].review_required).toBe(true);
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it("respects explicit performance bands when they imply a stronger floor", () => {
    const result = applyCriterionBandFloorRecalibration({
      breakdown: [
        buildItem({
          score: 12,
          max_score: 20,
          performance_band: "Good",
          comment: "The submission is coherent and correct.",
          reason_for_score: "Good concise reasoning with correct relationships.",
        }),
      ],
      extractionSuccess: true,
      extractedTextLength: 520,
    });

    expect(result.changed).toBe(true);
    expect(result.breakdown[0].score).toBe(14);
  });

  it("does not lift criteria with explicit harsh failure signals", () => {
    const result = applyCriterionBandFloorRecalibration({
      breakdown: [
        buildItem({
          score: 7,
          max_score: 20,
          comment: "Incorrect and missing key relationships.",
          reason_for_score: "Fails to meet the criterion because the decomposition is incorrect.",
        }),
      ],
      extractionSuccess: true,
      extractedTextLength: 520,
    });

    expect(result.changed).toBe(false);
    expect(result.total).toBe(7);
  });

  it("does not apply the floor when very little readable text was extracted", () => {
    const result = applyCriterionBandFloorRecalibration({
      breakdown: [
        buildItem({
          score: 12,
          max_score: 20,
          performance_band: "Good",
          comment: "The submission is coherent and correct.",
          reason_for_score: "Good concise reasoning with correct relationships.",
        }),
      ],
      extractionSuccess: true,
      extractedTextLength: 280,
    });

    expect(result.changed).toBe(false);
    expect(result.breakdown[0].score).toBe(12);
  });
});
