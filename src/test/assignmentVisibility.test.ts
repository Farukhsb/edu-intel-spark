import { describe, expect, it } from "vitest";

import {
  getStudentSubmissionAvailability,
  hasAssignmentDueDatePassed,
  isAssignmentDueSoon,
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

  it("flags assignments due within seven days as due soon", () => {
    expect(isAssignmentDueSoon("2026-05-02T12:00:00.000Z", now)).toBe(true);
    expect(isAssignmentDueSoon("2026-05-10T12:00:00.000Z", now)).toBe(false);
  });

  it("builds an open submission state for eligible students", () => {
    expect(
      getStudentSubmissionAvailability({
        assignment: {
          status: "published",
          due_date: "2026-04-29T13:00:00.000Z",
        },
        hasExistingSubmission: false,
        hasUser: true,
        now,
      }),
    ).toEqual({
      canSubmit: true,
      ctaLabel: "Submit My Work",
      helperText: "Upload your assignment file once. After submission, your work will enter the grading workflow.",
    });
  });

  it("builds a closed submission state once the due date has passed", () => {
    expect(
      getStudentSubmissionAvailability({
        assignment: {
          status: "published",
          due_date: "2026-04-29T11:00:00.000Z",
        },
        hasExistingSubmission: false,
        hasUser: true,
        now,
      }),
    ).toEqual({
      canSubmit: false,
      ctaLabel: "Closed",
      helperText: "The due date has passed, so this assignment is no longer accepting submissions.",
    });
  });

  it("builds an already-submitted state when the student has uploaded work", () => {
    expect(
      getStudentSubmissionAvailability({
        assignment: {
          status: "published",
          due_date: "2026-04-29T13:00:00.000Z",
        },
        hasExistingSubmission: true,
        hasUser: true,
        now,
      }),
    ).toEqual({
      canSubmit: false,
      ctaLabel: "Already Submitted",
      helperText: "You have already submitted this assignment.",
    });
  });
});
