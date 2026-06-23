import type { PlanModule, Resource, WeakCriterionInsight } from "@/lib/improvementPlanTypes";

import {
  buildFocusHeading,
  buildGuidanceLabel,
  buildGuidanceMode,
  extractConceptHint,
  normalizeCriterionLabel,
  normalizeFeedbackText,
  buildFeedbackSignal,
} from "@/lib/improvementPlanTextCore";
import { buildActionItems, buildEvidenceOfImprovement, buildFeedbackLedIssue } from "@/lib/improvementPlanTextAdvice";

const buildEstimatedLift = (average: number) => {
  if (average >= 60) return "Good recovery opportunity";
  if (average >= 50) return "Strong recovery opportunity";
  return "High recovery opportunity";
};

const buildPriorityLabel = (average: number, trend: PlanModule["trend"]) => {
  if (trend === "down" && average < 60) return "High impact, quick win";
  if (trend === "down") return "Needs attention";
  if (average >= 60) return "Quick win";
  return "High impact";
};

const buildEvidenceStrength = (criterion: WeakCriterionInsight): "strong" | "moderate" | "limited" => {
  const feedback = normalizeFeedbackText(criterion.feedback ?? "");
  const hasFeedback = feedback.length > 0;
  const looksSpecific =
    feedback.length >= 40 ||
    /(no visible|not clearly|descriptive|evaluative|supports claims|edge case|output evidence|average-case|worst-case)/i.test(feedback);

  if (hasFeedback && looksSpecific && criterion.attempts >= 1) {
    return "strong";
  }

  if (hasFeedback || criterion.attempts >= 2) {
    return "moderate";
  }

  return "limited";
};

const buildEvidenceBasis = (criterion: WeakCriterionInsight) => {
  const evidenceStrength = buildEvidenceStrength(criterion);
  if (evidenceStrength === "strong") {
    return "Based on direct criterion feedback from graded work.";
  }
  if (evidenceStrength === "moderate") {
    return "Based on repeated low criterion scores with some supporting feedback.";
  }
  return "Based on limited evidence from current graded work, so this guidance is intentionally broad.";
};

const buildDuration = (criterion: WeakCriterionInsight) => {
  const evidenceStrength = buildEvidenceStrength(criterion);
  if (evidenceStrength === "limited") return "short review";
  if (criterion.average >= 60) return "12 min review";
  if (criterion.average >= 50) return "15 min review";
  return "20 min review";
};

const buildWeakestCriterionSummary = (criterion: WeakCriterionInsight) =>
  `Weakest criterion: ${normalizeCriterionLabel(criterion.criterion)} (${(100 - criterion.average).toFixed(1).replace(/\.0$/, "")}% loss)`;

export const buildResourceRecommendations = (modules: PlanModule[]): Resource[] =>
  modules
    .flatMap((module) =>
      module.weakCriteria.slice(0, 2).map((criterion, index) => {
        const estimatedLift = buildEstimatedLift(criterion.average);
        const evidenceStrength = buildEvidenceStrength(criterion);
        const guidanceMode = module.guidanceMode ?? buildGuidanceMode(module.currentGrade);
        const conceptHint = criterion.feedback ? extractConceptHint(criterion.feedback) : null;
        const priorityScore =
          (100 - criterion.average) +
          (module.trend === "down" ? 10 : module.trend === "steady" ? 5 : 2) +
          Math.min(criterion.attempts * 3, 9);

        return {
          priority: index + 1,
          heading: buildFocusHeading(module.module, criterion.criterion),
          duration: buildDuration(criterion),
          estimatedLift,
          guidanceMode,
          guidanceLabel: buildGuidanceLabel(guidanceMode),
          module: module.module,
          criterion: normalizeCriterionLabel(criterion.criterion),
          weakestCriterionSummary: buildWeakestCriterionSummary(criterion),
          feedbackSignal: buildFeedbackSignal(criterion.feedback),
          conceptHint,
          issue: buildFeedbackLedIssue(criterion.criterion, criterion.feedback, module.module, guidanceMode),
          actionItems: buildActionItems(criterion.criterion, criterion.feedback, guidanceMode, conceptHint),
          evidenceOfImprovement: buildEvidenceOfImprovement(criterion.criterion, criterion.feedback, guidanceMode),
          priorityLabel: buildPriorityLabel(criterion.average, module.trend),
          priorityScore,
          evidenceStrength,
          evidenceBasis: buildEvidenceBasis(criterion),
        } satisfies Resource;
      }),
    )
    .sort((left, right) => right.priorityScore - left.priorityScore)
    .slice(0, 3)
    .map((resource, index) => ({
      ...resource,
      priority: index + 1,
    }));
