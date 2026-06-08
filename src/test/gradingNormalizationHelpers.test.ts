// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  clampConfidence,
  clampScore,
  normalizeBreakdown,
  normalizeMathAnalysis,
  normalizeOverallScore,
  normalizeStringList,
} from "../../supabase/functions/grade-submission/normalization";

describe("grading normalization helpers", () => {
  it("clamps score and confidence values into safe ranges", () => {
    expect(clampScore(-5, 20)).toBe(0);
    expect(clampScore("19.999", 20)).toBe(20);
    expect(clampConfidence(1.5)).toBe(1);
    expect(clampConfidence("not-a-number")).toBe(0);
  });

  it("normalizes lists and overall scores defensively", () => {
    expect(normalizeStringList(["A", " ", "B", 3, "C"])).toEqual(["A", "B", "C"]);
    expect(normalizeStringList(null, ["fallback"])).toEqual(["fallback"]);
    expect(normalizeOverallScore("17.2", 20)).toBe(17.2);
    expect(normalizeOverallScore("bad", 20)).toBeNull();
  });

  it("recalibrates contradictory breakdowns and accepts malformed math analysis safely", () => {
    const normalized = normalizeBreakdown(
      [
        {
          criterion: "Justification and trade-offs",
          awarded_score: 20,
          performance_band: "No evidence",
          reason_for_score: "No justification or discussion of design choices or trade-offs is provided.",
          evidence_from_submission: "No supporting quote extracted.",
          confidence_score: 0.4,
        },
      ],
      [
        {
          criterion: "Justification and trade-offs",
          weight: 20,
          description: "Explains design choices, limitations, and trade-offs.",
        },
      ],
    );

    expect(normalized.total).toBe(2);
    expect(normalized.recalibrated).toBe(true);
    expect(normalized.breakdown[0].review_required).toBe(true);

    expect(
      normalizeMathAnalysis({
        symbolic_extraction: ["x + 1"],
        derivation_checks: [{ step_label: "", status: "unknown", rationale: 123 }],
        error_classification: "unexpected",
        solver_signals: ["signal"],
      }),
    ).toEqual({
      symbolic_extraction: ["x + 1"],
      derivation_checks: [{ step_label: "Step", status: "unclear", rationale: "" }],
      error_classification: "none",
      solver_signals: ["signal"],
    });
  });
});
