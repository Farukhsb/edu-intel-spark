import { describe, expect, it } from "vitest";

import { getResetPasswordReadiness } from "@/lib/resetPasswordReadiness";

describe("reset password readiness", () => {
  it("covers the initial verification state", () => {
    expect(
      getResetPasswordReadiness({
        linkChecked: false,
        recoveryReady: false,
        isRecovered: false,
      }),
    ).toEqual({
      postureLabel: "Recovery verification position",
      likelyChallenge:
        "The reset link must still hold a valid recovery session before a new password can be accepted",
      bestNextAction:
        "Wait for the recovery link check to complete before entering a new password",
    });
  });

  it("covers the invalid-link and completion states", () => {
    expect(
      getResetPasswordReadiness({
        linkChecked: true,
        recoveryReady: false,
        isRecovered: false,
      }),
    ).toEqual({
      postureLabel: "Recovery link failure position",
      likelyChallenge: "Expired or pre-consumed reset links stop the final password update step",
      bestNextAction: "Request a fresh reset email and open only the latest recovery link in your browser",
    });

    expect(
      getResetPasswordReadiness({
        linkChecked: true,
        recoveryReady: true,
        isRecovered: true,
      }),
    ).toEqual({
      postureLabel: "Recovery completion position",
      likelyChallenge:
        "You still need to re-enter the platform through the normal sign-in path with the new password",
      bestNextAction: "Return to sign in and rejoin your academic workflow with the updated password",
    });
  });
});
