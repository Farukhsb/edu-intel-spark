export interface EdgePageReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

export const getNotFoundReadiness = (): EdgePageReadiness => ({
  postureLabel: "Route recovery position",
  likelyChallenge: "The page you tried to open is outside the current workflow or no longer exists at this route",
  bestNextAction: "Return to the main workspace entry and continue from the correct dashboard or public landing page",
});

export const getInstallReadiness = ({
  installed,
  installPromptAvailable,
}: {
  installed: boolean;
  installPromptAvailable: boolean;
}): EdgePageReadiness => {
  if (installed) {
    return {
      postureLabel: "Installed app position",
      likelyChallenge: "You still need to reopen the app from the device surface where it was installed",
      bestNextAction: "Launch GradeAI from your home screen or app launcher and continue in the same workflow",
    };
  }

  if (installPromptAvailable) {
    return {
      postureLabel: "Ready to install position",
      likelyChallenge: "This browser session supports a direct install prompt, but it still depends on your confirmation",
      bestNextAction: "Use the install action now to add GradeAI as a faster entry point for future workflow access",
    };
  }

  return {
    postureLabel: "Manual install position",
    likelyChallenge: "This browser is not exposing the direct install prompt automatically",
    bestNextAction: "Follow the device-specific install steps below to pin GradeAI for quicker return access",
  };
};
