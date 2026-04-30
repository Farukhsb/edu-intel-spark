import { describe, expect, it } from "vitest";

import {
  getStudentSubmissionAvailability,
  hasAssignmentDueDatePassed,
  isAssignmentDueSoon,
  isAssignmentVisibleToStudent,
} from "@/lib/assignmentVisibility";

describe("assignment visibility helpers", () => {
  const futureDueDate = "2099-04-29T13:00:00.000Z";
  const pastDueDate = "2000-04-29T13:00:00.000Z";

  it("detects when a due date has passed", () => {
    expect(hasAssignmentDueDatePassed(pastDueDate, new Date("2026-04-29T13:00:00.000Z").getTime())).toBe(true);
    expect(hasAssignmentDueDatePassed(futureDueDate, new Date("2026-04-29T13:00:00.000Z").getTime())).toBe(false);
  });

  it("treats only upcoming close deadlines as due soon", () => {
    const now = new Date("2026-04-29T13:00:00.000Z").getTime();
    const soonDueDate = new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString();
    const distantDueDate = new Date(now + 12 * 24 * 60 * 60 * 1000).toISOString();

    expect(isAssignmentDueSoon(soonDueDate, now)).toBe(true);
    expect(isAssignmentDueSoon(distantDueDate, now)).toBe(false);
    expect(isAssignmentDueSoon(pastDueDate, now)).toBe(false);
  });

  it("hides overdue assignments from student visibility", () => {
    expect(isAssignmentVisibleToStudent({ status: "published", due_date: futureDueDate })).toBe(true);
    expect(isAssignmentVisibleToStudent({ status: "published", due_date: pastDueDate })).toBe(false);
    expect(isAssignmentVisibleToStudent({ status: "draft", due_date: futureDueDate })).toBe(false);
  });

  it("computes open submission state for eligible students", () => {
    expect(
      getStudentSubmissionAvailability({
        assignment: { status: "published", due_date: futureDueDate },
        hasExistingSubmission: false,
        hasUser: true,
      }),
    ).toEqual({
      canSubmit: true,
      ctaLabel: "Submit My Work",
      helperText: "Upload your assignment file once. After submission, your work will enter the grading workflow.",
    });
  });

  it("computes blocked submission state for overdue or already-submitted work", () => {
    expect(
      getStudentSubmissionAvailability({
        assignment: { status: "published", due_date: pastDueDate },
        hasExistingSubmission: false,
        hasUser: true,
      }),
    ).toEqual({
      canSubmit: false,
      ctaLabel: "Closed",
      helperText: "The due date has passed, so this assignment is no longer accepting submissions.",
    });

    expect(
      getStudentSubmissionAvailability({
        assignment: { status: "published", due_date: futureDueDate },
        hasExistingSubmission: true,
        hasUser: true,
      }),
    ).toEqual({
      canSubmit: false,
      ctaLabel: "Already Submitted",
      helperText: "You have already submitted this assignment.",
    });
  });
});
