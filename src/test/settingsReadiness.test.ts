import { describe, expect, it } from "vitest";

import { getSettingsReadiness } from "@/lib/settingsReadiness";

describe("settings readiness", () => {
  it("prioritises missing profile data when account details are incomplete", () => {
    const readiness = getSettingsReadiness({
      role: "lecturer",
      fullName: "Dr Ada Lovelace",
      email: "ada@example.com",
      departmentId: null,
    });

    expect(readiness.postureLabel).toBe("Profile completion position");
    expect(readiness.likelyChallenge).toBe("department is still missing from your account record");
    expect(readiness.bestNextAction).toBe(
      "Ask your administrator to complete the missing account details before they affect workflow visibility",
    );
  });

  it("derives a lecturer-facing readiness summary when profile metadata is complete", () => {
    const readiness = getSettingsReadiness({
      role: "lecturer",
      fullName: "Dr Ada Lovelace",
      email: "ada@example.com",
      departmentId: "Computer Science",
    });

    expect(readiness.postureLabel).toBe("Teaching workflow position");
    expect(readiness.likelyChallenge).toBe(
      "Role and department settings now control lecturer-only workflow access",
    );
    expect(readiness.bestNextAction).toBe(
      "Check that your account details still match the teaching context you need to manage",
    );
  });
});
