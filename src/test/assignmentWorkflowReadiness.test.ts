import { describe, expect, it } from "vitest";

import {
  getLecturerAssignmentWorkflowReadiness,
  getStudentAssignmentWorkflowReadiness,
} from "@/pages/dashboard/assignment-detail/domain";

describe("assignment workflow readiness", () => {
  it("derives lecturer workflow readiness from moderation, release, and review states", () => {
    const readiness = getLecturerAssignmentWorkflowReadiness({
      statuses: ["submitted", "approved", "moderation_pending", "released"],
      hasReleaseReady: true,
      hasApprovable: false,
      integrityRuntimeWarning: null,
    });

    expect(readiness.postureLabel).toBe("Active review position");
    expect(readiness.likelyChallenge).toBe("1 submission still in moderation or escalation");
    expect(readiness.bestNextAction).toBe("Open moderation-linked submissions and clear blocked review cases");
  });

  it("derives student workflow readiness from the current submission state", () => {
    const readiness = getStudentAssignmentWorkflowReadiness({
      currentStatus: "released",
    });

    expect(readiness.postureLabel).toBe("Released result position");
    expect(readiness.likelyChallenge).toBe("Your released feedback is now available to review");
    expect(readiness.bestNextAction).toBe("Open the released result and review the feedback summary");
  });
});
