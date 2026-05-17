import { describe, expect, it } from "vitest";

import { calculateRiskScore } from "@/lib/riskCalculator";

describe("calculateRiskScore", () => {
  it("does not inflate trend risk for students with fewer than two grades", () => {
    const score = calculateRiskScore({
      submissions: [{ id: "submission-1" }],
      grades: [{ final_score: 78, ai_score: null }],
      totalAssignments: 1,
    });

    expect(score).toBe(15);
  });

  it("uses two grades to detect an improving trend", () => {
    const score = calculateRiskScore({
      submissions: [{ id: "submission-1" }, { id: "submission-2" }],
      grades: [
        { final_score: 52, ai_score: null },
        { final_score: 74, ai_score: null },
      ],
      totalAssignments: 2,
    });

    expect(score).toBe(23);
  });

  it("uses two grades to detect a declining trend", () => {
    const score = calculateRiskScore({
      submissions: [{ id: "submission-1" }, { id: "submission-2" }],
      grades: [
        { final_score: 74, ai_score: null },
        { final_score: 52, ai_score: null },
      ],
      totalAssignments: 2,
    });

    expect(score).toBe(38);
  });
});
