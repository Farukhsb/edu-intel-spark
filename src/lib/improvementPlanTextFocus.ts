import type { GuidanceMode } from "@/lib/improvementPlanTypes";

import { normalizeCriterionLabel } from "@/lib/improvementPlanTextCore";

export const buildNextSubmissionFocus = (criterion: string, feedback: string | undefined, mode: GuidanceMode) => {
  const normalizedFeedback = (feedback ?? "").toLowerCase();
  const normalizedCriterion = normalizeCriterionLabel(criterion);

  if (
    normalizedFeedback.includes("descriptive") ||
    normalizedFeedback.includes("not evaluative") ||
    normalizedFeedback.includes("does not clearly evaluate")
  ) {
    return mode === "recovery"
      ? `Recover ${normalizedCriterion.toLowerCase()} by turning description into evaluation with comparison, evidence, and a final judgement.`
      : `Strengthen ${normalizedCriterion.toLowerCase()} next time by turning description into evaluation with comparison, evidence, and a final judgement.`;
  }

  if (
    normalizedFeedback.includes("no visible test") ||
    normalizedFeedback.includes("visible testing") ||
    normalizedFeedback.includes("output evidence")
  ) {
    return mode === "recovery"
      ? `Recover ${normalizedCriterion.toLowerCase()} by adding visible outputs, an edge case, and a final program state the marker can verify.`
      : `Improve ${normalizedCriterion.toLowerCase()} next time by adding visible outputs, an edge case, and a final program state the marker can verify.`;
  }

  if (
    normalizedFeedback.includes("supports claims weakly") ||
    normalizedFeedback.includes("evidence supports") ||
    normalizedFeedback.includes("textual support")
  ) {
    return mode === "recovery"
      ? `Recover ${normalizedCriterion.toLowerCase()} by adding stronger evidence and explaining exactly what each example proves.`
      : `Improve ${normalizedCriterion.toLowerCase()} next time by adding stronger evidence and explaining exactly what each example proves.`;
  }

  return mode === "recovery"
    ? `Recover ${normalizedCriterion.toLowerCase()} by making the intended reasoning and evidence more explicit against the rubric.`
    : `Improve ${normalizedCriterion.toLowerCase()} next time by making the intended reasoning and evidence more explicit against the rubric.`;
};
