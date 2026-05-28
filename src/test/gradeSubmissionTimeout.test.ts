import { describe, expect, it } from "vitest";

import {
  buildGradingErrorEventPayload,
  classifyGradingError,
  toSafeGradingErrorMessage,
} from "../../supabase/functions/grade-submission/error-telemetry";

describe("grade-submission timeout telemetry", () => {
  it("classifies OpenAI timeouts as service failures with retry wording", () => {
    const reason = "OpenAI grading request timed out after 60000ms. Retry the submission or try again later.";

    expect(classifyGradingError(reason)).toEqual({
      errorCode: "openai_timeout",
      safeErrorCategory: "service_failure",
    });
    expect(toSafeGradingErrorMessage(reason)).toBe(reason);
    expect(toSafeGradingErrorMessage(reason)).not.toContain("re-upload");
  });

  it("builds a schema-safe grading error payload without unsupported metadata", () => {
    const payload = buildGradingErrorEventPayload({
      submissionId: "submission-1",
      assignmentId: "assignment-1",
      userId: "user-1",
      provider: "openai",
      reason: "OpenAI grading request timed out after 60000ms. Retry the submission or try again later.",
    });

    expect(payload).toEqual({
      submission_id: "submission-1",
      assignment_id: "assignment-1",
      user_id: "user-1",
      provider: "openai",
      error_code: "openai_timeout",
      error_message: "OpenAI grading request timed out after 60000ms. Retry the submission or try again later.",
      safe_error_category: "service_failure",
    });
    expect(Object.keys(payload)).not.toContain("metadata");
  });
});
