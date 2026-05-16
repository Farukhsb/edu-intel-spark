import { describe, expect, it } from "vitest";

import { getPublicLandingReadiness } from "@/lib/publicLanding";

describe("public landing readiness", () => {
  it("returns the public workflow framing used on the landing page", () => {
    expect(getPublicLandingReadiness()).toEqual({
      postureLabel: "Production-style academic workflow",
      likelyChallenge:
        "Assessment teams need one platform that covers marking, integrity, moderation, and reporting without fragmented tools",
      bestNextAction:
        "Open the demo or sign in to see the full workflow from released results to institutional oversight",
    });
  });
});
