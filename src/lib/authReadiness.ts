export interface AuthReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

export const getAuthReadiness = ({
  forgotPassword,
}: {
  forgotPassword: boolean;
}): AuthReadiness => {
  if (forgotPassword) {
    return {
      postureLabel: "Account recovery position",
      likelyChallenge: "Password recovery needs the same institutional email identity used for your academic workflow",
      bestNextAction: "Submit your account email and return through the reset link to regain dashboard access",
    };
  }

  return {
    postureLabel: "Workspace access position",
    likelyChallenge: "Your sign-in details control whether you enter the correct lecturer, student, or admin workflow",
    bestNextAction: "Use your institutional account or create one so the platform can route you into the right workspace",
  };
};
