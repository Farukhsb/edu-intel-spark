export type GradeTone = "success" | "primary" | "destructive";

export const getGradeTone = (score: number, maxScore = 100): GradeTone => {
  const ratio = score / Math.max(maxScore, 1);
  if (ratio >= 0.7) return "success";
  if (ratio >= 0.5) return "primary";
  return "destructive";
};

export const getGradeBadgeVariant = (score: number, maxScore = 100) => {
  const tone = getGradeTone(score, maxScore);
  if (tone === "success") return "default" as const;
  if (tone === "primary") return "secondary" as const;
  return "destructive" as const;
};
