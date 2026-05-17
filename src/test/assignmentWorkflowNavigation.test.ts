import { describe, expect, it } from "vitest";

import {
  getAssignmentWorkflowTarget,
  getAssignmentWorkflowTargetFromStats,
} from "@/lib/assignmentWorkflowNavigation";

describe("assignmentWorkflowNavigation", () => {
  it("maps submission-level under-review state to the manual review queue", () => {
    expect(
      getAssignmentWorkflowTarget({
        assignmentId: "assignment-1",
        status: "under_review",
      }),
    ).toEqual({
      href: "/dashboard/assignments/assignment-1?source=queue&focus=manual-review",
      label: "Open manual review",
    });
  });

  it("maps assignment stats with pending review work to the focused review queue", () => {
    expect(
      getAssignmentWorkflowTargetFromStats({
        assignmentId: "assignment-1",
        stats: {
          total: 8,
          needsReview: 3,
          graded: 4,
          approved: 1,
          released: 0,
        },
      }),
    ).toEqual({
      href: "/dashboard/assignments/assignment-1?source=notification&focus=submission-review",
      label: "Open review queue",
    });
  });

  it("maps assignment stats with release-ready work to the focused release queue", () => {
    expect(
      getAssignmentWorkflowTargetFromStats({
        assignmentId: "assignment-1",
        stats: {
          total: 8,
          needsReview: 0,
          graded: 8,
          approved: 5,
          released: 2,
        },
      }),
    ).toEqual({
      href: "/dashboard/assignments/assignment-1?source=queue&focus=release-ready",
      label: "Open release queue",
    });
  });
});
