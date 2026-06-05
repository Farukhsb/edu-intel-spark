import { describe, expect, it } from "vitest";

import {
  parseAdminDashboardSearchState,
  parseAssignmentDetailSearchState,
  parseAssignmentsSearchState,
  parseExplainGradeSearchState,
  parsePerformanceTrendsSearchState,
} from "@/lib/schemas/navigation";

describe("navigation schemas", () => {
  it("accepts valid explain-grade search params and drops unknown source values", () => {
    const valid = parseExplainGradeSearchState(
      new URLSearchParams("assignment=assignment-1&submission=submission-1&source=notification"),
    );
    const invalid = parseExplainGradeSearchState(
      new URLSearchParams("assignment=&submission=submission-2&source=bogus"),
    );

    expect(valid).toEqual({
      assignmentId: "assignment-1",
      submissionId: "submission-1",
      source: "notification",
      ltiContextId: null,
      ltiResourceLinkId: null,
      ltiProvider: null,
      ltiIssuer: null,
    });

    expect(invalid).toEqual({
      assignmentId: null,
      submissionId: "submission-2",
      source: null,
      ltiContextId: null,
      ltiResourceLinkId: null,
      ltiProvider: null,
      ltiIssuer: null,
    });
  });

  it("accepts only known assignment-detail focus routes", () => {
    const moderation = parseAssignmentDetailSearchState(
      new URLSearchParams("source=moderation&focus=release-ready"),
    );
    const notification = parseAssignmentDetailSearchState(
      new URLSearchParams("source=notification&focus=ai-results"),
    );
    const invalid = parseAssignmentDetailSearchState(
      new URLSearchParams("source=notification&focus=unknown"),
    );

    expect(moderation).toEqual({
      moderationReleaseFocus: true,
      notificationFocus: null,
      queueFocus: null,
    });
    expect(notification).toEqual({
      moderationReleaseFocus: false,
      notificationFocus: "ai-results",
      queueFocus: null,
    });
    expect(
      parseAssignmentDetailSearchState(
        new URLSearchParams("source=queue&focus=manual-review"),
      ),
    ).toEqual({
      moderationReleaseFocus: false,
      notificationFocus: null,
      queueFocus: "manual-review",
    });
    expect(invalid).toEqual({
      moderationReleaseFocus: false,
      notificationFocus: null,
      queueFocus: null,
    });
  });

  it("normalizes assignments search params to known status and view values", () => {
    const valid = parseAssignmentsSearchState(
      new URLSearchParams("status=published&view=needs-review"),
    );
    const invalid = parseAssignmentsSearchState(
      new URLSearchParams("status=bogus&view=unexpected"),
    );

    expect(valid).toEqual({
      statusFilter: "published",
      view: "needs-review",
    });
    expect(invalid).toEqual({
      statusFilter: "all",
      view: null,
    });
  });

  it("normalizes admin dashboard search params to known view and user filter values", () => {
    const valid = parseAdminDashboardSearchState(
      new URLSearchParams("view=moderation-audit&filter=lecturer"),
    );
    const compliance = parseAdminDashboardSearchState(new URLSearchParams("view=compliance"));
    const invalid = parseAdminDashboardSearchState(
      new URLSearchParams("view=unknown&filter=staff"),
    );

    expect(valid).toEqual({
      view: "moderation-audit",
      userFilter: "lecturer",
    });
    expect(compliance).toEqual({
      view: "compliance",
      userFilter: null,
    });
    expect(invalid).toEqual({
      view: "overview",
      userFilter: null,
    });
  });

  it("normalizes performance trend filters to known risk and score-band values", () => {
    const valid = parsePerformanceTrendsSearchState(
      new URLSearchParams("risk=high-plus&scoreBand=lt40"),
    );
    const invalid = parsePerformanceTrendsSearchState(
      new URLSearchParams("risk=extreme&scoreBand=???"),
    );

    expect(valid).toEqual({
      riskFilter: "high-plus",
      scoreBandFilter: "lt40",
    });
    expect(invalid).toEqual({
      riskFilter: "all",
      scoreBandFilter: "all",
    });
  });
});
