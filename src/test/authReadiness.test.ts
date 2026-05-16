import { describe, expect, it } from "vitest";

import { getAuthReadiness } from "@/lib/authReadiness";

describe("auth readiness", () => {
  it("describes the main sign-in posture by default", () => {
    expect(getAuthReadiness({ forgotPassword: false })).toEqual({
      postureLabel: "Workspace access position",
      likelyChallenge:
        "Your sign-in details control whether you enter the correct lecturer, student, or admin workflow",
      bestNextAction:
        "Use your institutional account or create one so the platform can route you into the right workspace",
    });
  });

  it("switches to recovery framing for the reset flow", () => {
    expect(getAuthReadiness({ forgotPassword: true })).toEqual({
      postureLabel: "Account recovery position",
      likelyChallenge:
        "Password recovery needs the same institutional email identity used for your academic workflow",
      bestNextAction:
        "Submit your account email and return through the reset link to regain dashboard access",
    });
  });
});
