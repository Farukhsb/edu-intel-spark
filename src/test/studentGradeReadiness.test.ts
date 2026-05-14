import { describe, expect, it } from "vitest";

import { getStudentGradeReadiness } from "@/lib/studentGradeReadiness";

describe("student grade readiness", () => {
  it("prioritizes released results when feedback is available", () => {
    const readiness = getStudentGradeReadiness({
      releasedCount: 1,
      pendingCount: 1,
      latestReleasedAssignmentTitle: "Algorithms Essay",
      latestPendingStatus: "moderation_in_progress",
    });

    expect(readiness.postureLabel).toBe("You have a released result ready");
    expect(readiness.likelyChallenge).toBe("Algorithms Essay has feedback ready to review");
    expect(readiness.bestNextAction).toBe("Open the released result and review the criterion feedback");
  });

  it("falls back to pending review messaging when no released results exist", () => {
    const readiness = getStudentGradeReadiness({
      releasedCount: 0,
      pendingCount: 1,
      latestReleasedAssignmentTitle: null,
      latestPendingStatus: "moderation_in_progress",
    });

    expect(readiness.postureLabel).toBe("Your result is still being prepared");
    expect(readiness.likelyChallenge).toBe("moderation in progress is still blocking release");
    expect(readiness.bestNextAction).toBe("Wait for marking and moderation to complete before checking again");
  });
});
