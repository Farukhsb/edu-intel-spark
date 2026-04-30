import { describe, expect, it } from "vitest";

import {
  hasAssignmentDueDatePassed,
  isAssignmentVisibleToStudent,
} from "@/lib/assignmentVisibility";

describe("assignmentVisibility", () => {
  const now = new Date("2026-04-29T12:00:00.000Z").getTime();

  it("keeps published future-due assignments visible to students", () => {
    expect(
      isAssignmentVisibleToStudent(
        {
          status: "published",
          due_date: "2026-04-29T13:00:00.000Z",
        },
        now,
      ),
    ).toBe(true);
  });

  it("hides published assignments once the due date has passed", () => {
    expect(
      isAssignmentVisibleToStudent(
        {
          status: "published",
          due_date: "2026-04-29T11:00:00.000Z",
        },
        now,
      ),
    ).toBe(false);
  });

  it("does not hide undated published assignments", () => {
    expect(
      isAssignmentVisibleToStudent(
        {
          status: "published",
          due_date: null,
        },
        now,
      ),
    ).toBe(true);
  });

  it("treats the exact due timestamp as no longer visible", () => {
    expect(hasAssignmentDueDatePassed("2026-04-29T12:00:00.000Z", now)).toBe(true);
  });
});
