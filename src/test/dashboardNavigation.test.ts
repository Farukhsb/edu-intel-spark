import { describe, expect, it } from "vitest";

import { lecturerSections } from "@/lib/dashboardNavigation";

describe("dashboard navigation", () => {
  it("surfaces a cohort dashboard entry for lecturer-equivalent academic roles", () => {
    const teachingInsights = lecturerSections.find((section) => section.label === "Teaching Insights");

    expect(teachingInsights).toBeDefined();
    expect(teachingInsights?.links.some((link) => link.label === "Cohort Dashboard")).toBe(true);
    expect(teachingInsights?.links.some((link) => link.to === "/dashboard/cohort-dashboard")).toBe(true);
  });
});
