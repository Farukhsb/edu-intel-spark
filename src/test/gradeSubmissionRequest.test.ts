// @vitest-environment node

import { describe, expect, it } from "vitest";

import { parseGradeSubmissionRequestPayload } from "../../supabase/functions/_shared/grade-submission-request";

describe("grade-submission request parsing", () => {
  it("accepts the direct submissionIds request shape", () => {
    const result = parseGradeSubmissionRequestPayload({
      submissionIds: [
        "6f951f5c-2665-48c8-b404-3ef9b6288882",
        "985386a6-9981-48eb-8277-568b0ec4957f",
      ],
      assignmentId: "11111111-1111-4111-8111-111111111111",
      force_regenerate: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data).toEqual({
      submissionIds: [
        "6f951f5c-2665-48c8-b404-3ef9b6288882",
        "985386a6-9981-48eb-8277-568b0ec4957f",
      ],
      assignmentId: "11111111-1111-4111-8111-111111111111",
      force_regenerate: true,
    });
  });

  it("accepts the legacy submissions array and nested assignment id shape", () => {
    const result = parseGradeSubmissionRequestPayload({
      submissions: [
        { id: "6f951f5c-2665-48c8-b404-3ef9b6288882" },
        "985386a6-9981-48eb-8277-568b0ec4957f",
        { bad: "skip me" },
      ],
      assignment: {
        id: "11111111-1111-4111-8111-111111111111",
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data).toEqual({
      submissionIds: [
        "6f951f5c-2665-48c8-b404-3ef9b6288882",
        "985386a6-9981-48eb-8277-568b0ec4957f",
      ],
      assignmentId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("rejects invalid payloads without a valid submission id source", () => {
    const result = parseGradeSubmissionRequestPayload({
      submissionIds: ["not-a-uuid"],
      assignmentId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.error.issues.length).toBeGreaterThan(0);
  });
});
