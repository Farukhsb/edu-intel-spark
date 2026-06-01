import { describe, expect, it } from "vitest";

import { buildGradeSelectorLabels, getBreakdownMaxScore } from "@/pages/dashboard/explain-grade/helpers";

describe("explain-grade helpers", () => {
  it("handles empty breakdown items safely", () => {
    expect(getBreakdownMaxScore({} as Parameters<typeof getBreakdownMaxScore>[0])).toBe(0);
  });

  it("builds selector labels without leaking student names", () => {
    expect(
      buildGradeSelectorLabels({
        assignmentTitle: "Data Structures Assignment",
        fileName: "Nkechi Onwumere CV.docx",
        releasedAt: "2026-04-29T10:00:00.000Z",
        score: 67,
      }),
    ).toEqual({
      label: "Data Structures Assignment \u2014 67%",
      assessment: "Data Structures Assignment",
      secondaryLabel: "Nkechi Onwumere CV.docx \u00b7 Released 29 Apr 2026",
    });
  });

  it("falls back to released grade labels when metadata is missing", () => {
    expect(
      buildGradeSelectorLabels({
        assignmentTitle: null,
        fileName: null,
        score: 41,
      }),
    ).toMatchObject({
      label: "Released grade \u2014 41%",
      assessment: "Released grade",
      secondaryLabel: null,
    });
  });
});
