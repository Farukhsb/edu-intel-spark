import { describe, expect, it } from "vitest";

import { getExplainGradeReadiness } from "@/lib/explainGradeReadiness";

describe("explain grade readiness", () => {
  it("prioritizes the top improvement route when one exists", () => {
    const readiness = getExplainGradeReadiness({
      assignmentLabel: "Algorithms Essay",
      band: "Merit",
      strongestArea: "Argument",
      topImprovementArea: {
        area: "Evidence",
        nextBand: "Distinction",
        pointsNeeded: 6,
      },
    });

    expect(readiness.postureLabel).toBe("Released explanation position");
    expect(readiness.likelyChallenge).toBe("Algorithms Essay is closest to improving through Evidence");
    expect(readiness.bestNextAction).toBe("Use the Evidence guidance to work toward Distinction");
  });
});
