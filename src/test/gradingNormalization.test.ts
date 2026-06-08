// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildGradingCandidate, hasMeaningfulScoreDrift, normalizeBreakdown } from "../../supabase/functions/grade-submission/calibration";
import type { RubricCriterion } from "../../supabase/functions/grade-submission/prompting";

describe("grading normalization", () => {
  it("caps contradictory high scores when the criterion rationale says there is no evidence", () => {
    const rubric: RubricCriterion[] = [
      {
        criterion: "Justification and trade-offs",
        weight: 20,
        description: "Explains design choices, limitations, and trade-offs.",
      },
    ];

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
      rubric,
    );

    expect(normalized.total).toBe(2);
    expect(normalized.breakdown[0].score).toBe(2);
    expect(normalized.recalibrated).toBe(true);
    expect(
      normalized.fairnessNotes.some((note) => note.includes("described missing or absent evidence")),
    ).toBe(true);
  });

  it("detects meaningful regrade drift and preserves candidate metadata", () => {
    expect(hasMeaningfulScoreDrift(10, 22, 100)).toBe(true);

    const candidate = buildGradingCandidate(
      {
        score: 40,
        total_score: 40,
        feedback: "Clear work with solid evidence.",
        criteria: [
          {
            criterion_name: "Analysis",
            awarded_score: 20,
            max_score: 20,
            reason_for_score: "Clear work.",
            evidence_from_submission: ["Clear evidence"],
            confidence_score: 0.8,
          },
        ],
      },
      [{ criterion: "Analysis", weight: 20, description: "Analyse the work." }],
      100,
    );

    expect(candidate.normalized.total).toBe(20);
    expect(candidate.modelFeedback).toContain("Clear work");
  });
});
