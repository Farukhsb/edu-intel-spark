export interface PublicLandingReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

export const getPublicLandingReadiness = (): PublicLandingReadiness => ({
  postureLabel: "Production-style academic workflow",
  likelyChallenge: "Assessment teams need one platform that covers marking, integrity, moderation, and reporting without fragmented tools",
  bestNextAction: "Open the demo or sign in to see the full workflow from released results to institutional oversight",
});
