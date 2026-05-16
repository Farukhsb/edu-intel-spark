export interface ResetPasswordReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

export const getResetPasswordReadiness = ({
  linkChecked,
  recoveryReady,
  isRecovered,
}: {
  linkChecked: boolean;
  recoveryReady: boolean;
  isRecovered: boolean;
}): ResetPasswordReadiness => {
  if (!linkChecked) {
    return {
      postureLabel: "Recovery verification position",
      likelyChallenge: "The reset link must still hold a valid recovery session before a new password can be accepted",
      bestNextAction: "Wait for the recovery link check to complete before entering a new password",
    };
  }

  if (!recoveryReady) {
    return {
      postureLabel: "Recovery link failure position",
      likelyChallenge: "Expired or pre-consumed reset links stop the final password update step",
      bestNextAction: "Request a fresh reset email and open only the latest recovery link in your browser",
    };
  }

  if (isRecovered) {
    return {
      postureLabel: "Recovery completion position",
      likelyChallenge: "You still need to re-enter the platform through the normal sign-in path with the new password",
      bestNextAction: "Return to sign in and rejoin your academic workflow with the updated password",
    };
  }

  return {
    postureLabel: "Password replacement position",
    likelyChallenge: "Your new password must be strong enough to restore access without introducing another account risk",
    bestNextAction: "Choose a strong new password and confirm it once before returning to sign in",
  };
};
