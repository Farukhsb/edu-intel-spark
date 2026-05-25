// @vitest-environment node

import { describe, expect, it } from "vitest";

import { normalizeBreakdown } from "../../supabase/functions/grade-submission/grading-support";
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
});
