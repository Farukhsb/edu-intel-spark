import { describe, expect, it } from "vitest";

import { summarizeAssignmentPublishWorkflow } from "@/lib/assignmentPublishWorkflow";

describe("assignment publish workflow summary", () => {
  it("returns a clean outcome when publish notifications complete", () => {
    const result = summarizeAssignmentPublishWorkflow({
      targetingStatus: "ready",
      recipientStatus: "loaded",
      bellStatus: "sent",
      emailStatus: "sent",
    });

    expect(result).toEqual({
      ok: true,
      warnings: [],
    });
  });

  it("surfaces partial notification failures after publish succeeds", () => {
    const result = summarizeAssignmentPublishWorkflow({
      targetingStatus: "ready",
      recipientStatus: "loaded",
      bellStatus: "failed",
      emailStatus: "failed",
    });

    expect(result.ok).toBe(false);
    expect(result.warnings).toEqual([
      "In-app student notifications were not saved",
      "Publish email notifications were not sent",
    ]);
  });

  it("warns when a published assignment has no stored targeting", () => {
    const result = summarizeAssignmentPublishWorkflow({
      targetingStatus: "missing",
      recipientStatus: "skipped",
      bellStatus: "skipped",
      emailStatus: "skipped",
    });

    expect(result.ok).toBe(false);
    expect(result.warnings).toEqual([
      "No target cohorts or departments were stored, so student notifications were skipped",
    ]);
  });

  it("warns when no student recipients are found for the publish notice", () => {
    const result = summarizeAssignmentPublishWorkflow({
      targetingStatus: "ready",
      recipientStatus: "no_recipients",
      bellStatus: "skipped",
      emailStatus: "duplicate",
    });

    expect(result.ok).toBe(false);
    expect(result.warnings).toEqual([
      "No matching students were found for in-app publish notifications",
    ]);
  });
});
