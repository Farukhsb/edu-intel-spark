import { describe, expect, it } from "vitest";

import { getInstallReadiness, getNotFoundReadiness } from "@/lib/edgePageReadiness";

describe("edge page readiness", () => {
  it("returns the 404 recovery framing", () => {
    expect(getNotFoundReadiness()).toEqual({
      postureLabel: "Route recovery position",
      likelyChallenge: "The page you tried to open is outside the current workflow or no longer exists at this route",
      bestNextAction: "Return to the main workspace entry and continue from the correct dashboard or public landing page",
    });
  });

  it("adapts install readiness between manual and prompt-driven states", () => {
    expect(getInstallReadiness({ installed: false, installPromptAvailable: false })).toEqual({
      postureLabel: "Manual install position",
      likelyChallenge: "This browser is not exposing the direct install prompt automatically",
      bestNextAction: "Follow the device-specific install steps below to pin GradeAI for quicker return access",
    });

    expect(getInstallReadiness({ installed: false, installPromptAvailable: true })).toEqual({
      postureLabel: "Ready to install position",
      likelyChallenge: "This browser session supports a direct install prompt, but it still depends on your confirmation",
      bestNextAction: "Use the install action now to add GradeAI as a faster entry point for future workflow access",
    });
  });
});
