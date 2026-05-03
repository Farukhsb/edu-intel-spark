import { describe, expect, it } from "vitest";

import { getLecturerOverviewReadiness } from "@/lib/lecturerOverviewReadiness";

describe("lecturer overview readiness", () => {
  it("prioritises the live review queue when submissions are still pending", () => {
    const readiness = getLecturerOverviewReadiness({
      pendingCount: 3,
      atRiskCount: 1,
      assignmentCount: 4,
      leadPendingAssignmentTitle: "Algorithms",
    });

    expect(readiness.postureLabel).toBe("Active review position");
    expect(readiness.likelyChallenge).toBe("Algorithms is still leading the review queue");
    expect(readiness.bestNextAction).toBe(
      "Clear grading, moderation, and approval blockers before the queue grows further",
    );
  });

  it("falls back to a support posture when review pressure is clear but no queue remains", () => {
    const readiness = getLecturerOverviewReadiness({
      pendingCount: 0,
      atRiskCount: 2,
      assignmentCount: 3,
      leadPendingAssignmentTitle: null,
    });

    expect(readiness.postureLabel).toBe("Targeted support position");
    expect(readiness.likelyChallenge).toBe("2 students still sit below target");
    expect(readiness.bestNextAction).toBe(
      "Open performance insights and prioritise support for the highest-risk students",
    );
  });
});
