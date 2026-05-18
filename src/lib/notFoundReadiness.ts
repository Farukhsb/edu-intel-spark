export interface NotFoundReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

export const getNotFoundReadiness = (): NotFoundReadiness => ({
  postureLabel: "Route recovery position",
  likelyChallenge: "The page you tried to open is outside the current workflow or no longer exists at this route",
  bestNextAction: "Return to the main workspace entry and continue from the correct dashboard or public landing page",
});
