import { describe, expect, it } from "vitest";

import { adminSections, lecturerSections } from "@/lib/dashboardNavigation";

describe("dashboard navigation", () => {
  it("surfaces a cohort dashboard entry for lecturer-equivalent academic roles", () => {
    const teachingInsights = lecturerSections.find((section) => section.label === "Student Support");

    expect(teachingInsights).toBeDefined();
    expect(teachingInsights?.links.some((link) => link.label === "Cohort Dashboard")).toBe(true);
    expect(teachingInsights?.links.some((link) => link.to === "/dashboard/cohort-dashboard")).toBe(true);
    expect(teachingInsights?.links.some((link) => link.label === "CohortSignal Heatmap")).toBe(true);
    expect(teachingInsights?.links.some((link) => link.to === "/dashboard/cohortsignal")).toBe(true);
  });

  it("surfaces an admin oversight entry for CohortSignal", () => {
    const riskSection = adminSections.find((section) => section.label === "Risk");

    expect(riskSection).toBeDefined();
    expect(riskSection?.links.some((link) => link.label === "CohortSignal Oversight")).toBe(true);
    expect(riskSection?.links.some((link) => link.to === "/dashboard/cohortsignal")).toBe(true);
  });
});
