import { describe, expect, it } from "vitest";

import { getDashboardShellContext } from "@/lib/dashboardShell";

describe("dashboard shell context", () => {
  it("uses active section metadata when it is available", () => {
    const context = getDashboardShellContext({
      isAdmin: false,
      isLecturerEquivalent: true,
      activeSectionLabel: "Assessment",
      activeSectionDescription: "Review, integrity, and moderation",
      activeLinkLabel: "Academic Integrity",
    });

    expect(context.workspaceLabel).toBe("Assessment");
    expect(context.workspaceHint).toBe("Academic Integrity sits in review, integrity, and moderation.");
  });

  it("falls back to the student workspace cue when no section metadata exists", () => {
    const context = getDashboardShellContext({
      isAdmin: false,
      isLecturerEquivalent: false,
      activeSectionLabel: null,
      activeSectionDescription: null,
      activeLinkLabel: "My Grades",
    });

    expect(context.workspaceLabel).toBe("Student workspace");
    expect(context.workspaceHint).toBe(
      "Use this area to review results, assignments, and your next support actions.",
    );
  });
});
