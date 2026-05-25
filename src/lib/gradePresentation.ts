export type GradeTone = "success" | "primary" | "destructive";

export const normalizeMaxScore = (maxScore: number | null | undefined) =>
  maxScore && maxScore > 0 ? maxScore : 100;

export const clampPercentage = (score: number | null | undefined, maxScore: number | null | undefined) => {
  if (score == null || maxScore == null || maxScore <= 0) return 0;
  const percent = Math.round((score / maxScore) * 100);
  return Math.min(100, Math.max(0, percent));
};

export const getGradeTone = (score: number, maxScore: number | null | undefined = 100): GradeTone => {
  const ratio = score / normalizeMaxScore(maxScore);
  if (ratio >= 0.7) return "success";
  if (ratio >= 0.5) return "primary";
  return "destructive";
};

export const getGradeBadgeVariant = (score: number, maxScore: number | null | undefined = 100) => {
  const tone = getGradeTone(score, maxScore);
  if (tone === "success") return "default" as const;
  if (tone === "primary") return "secondary" as const;
  return "destructive" as const;
};
