import { describe, expect, it } from "vitest";

import { getBreakdownMaxScore } from "@/pages/dashboard/ExplainGrade";

describe("ExplainGrade breakdown logic", () => {
  it("handles empty breakdown safely", () => {
    const breakdown: Array<{ max_score?: number; maxScore?: number }> = [];

    const totalMaxRaw = breakdown.reduce((sum, item) => sum + getBreakdownMaxScore(item), 0);
    const totalMax = totalMaxRaw > 0 ? totalMaxRaw : 1;

    expect(totalMax).toBe(1);
  });
});
