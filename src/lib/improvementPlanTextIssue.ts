import type { GuidanceMode } from "@/lib/improvementPlanTypes";

import {
  buildConceptPhrase,
  buildConceptVerb,
  buildModuleContext,
  extractConceptHint,
  normalizeCriterionLabel,
  normalizeFeedbackText,
} from "@/lib/improvementPlanTextCore";

const buildIssue = (criterion: string, module: string, mode: GuidanceMode) => {
  const normalized = criterion.toLowerCase();
  const timeframe = mode === "recovery" ? "To recover this submission, " : "For future assignments, ";

  if (normalized.includes("complexity")) {
    return `${timeframe}your complexity explanation needs clearer separation between average-case and worst-case behaviour.`;
  }

  if (normalized.includes("test")) {
    return `${timeframe}the marker still cannot see enough visible test evidence to verify that the implementation works in practice.`;
  }

  if (normalized.includes("evidence")) {
    return `${timeframe}your evidence needs to do more analytical work so the support for each claim is explicit.`;
  }

  if (normalized.includes("analysis") || normalized.includes("comparison")) {
    return `${timeframe}this area still reads as descriptive rather than evaluative, so the marker cannot clearly see comparison, judgement, or critical weighting.`;
  }

  if (normalized.includes("dynamic programming")) {
    return `${timeframe}the solution structure is not visible enough for the marker to follow how the recurrence and subproblems produce the final answer.`;
  }

  if (normalized.includes("report") || normalized.includes("quality") || normalized.includes("overall")) {
    return `${timeframe}the overall submission quality in ${module} is being held back by missing visible evidence, explanation, or final polish.`;
  }

  return `${timeframe}${normalizeCriterionLabel(criterion)} is weaker than your stronger areas because the intended evidence or reasoning is not yet visible enough to the marker.`;
};

const buildIssueFromFeedback = (
  criterion: string,
  feedback: string,
  module: string,
  mode: GuidanceMode,
) => {
  const normalizedFeedback = normalizeFeedbackText(feedback).toLowerCase();
  const normalizedCriterion = normalizeCriterionLabel(criterion);
  const lowerCriterion = normalizedCriterion.toLowerCase();
  const moduleContext = buildModuleContext(module);
  const conceptHint = extractConceptHint(feedback);
  const conceptLead = buildConceptPhrase(conceptHint, lowerCriterion);
  const conceptVerb = buildConceptVerb(conceptLead);

  if (
    normalizedFeedback.includes("not shown") ||
    normalizedFeedback.includes("not visible") ||
    normalizedFeedback.includes("not demonstrated") ||
    normalizedFeedback.includes("no visible test")
  ) {
    return `In your ${moduleContext.moduleRef}, ${conceptLead} ${conceptVerb} not visibly demonstrated, so the marker could not verify it clearly.`;
  }

  if (
    normalizedFeedback.includes("too descriptive") ||
    normalizedFeedback.includes("lacks evaluation") ||
    normalizedFeedback.includes("not evaluative") ||
    normalizedFeedback.includes("does not clearly evaluate")
  ) {
    return `In your ${moduleContext.assignmentRef}, ${conceptLead} describes concepts but does not evaluate them clearly enough for the marker to see a defended judgement.`;
  }

  if (
    normalizedFeedback.includes("missing evidence") ||
    normalizedFeedback.includes("no examples") ||
    normalizedFeedback.includes("supports claims weakly") ||
    normalizedFeedback.includes("textual support")
  ) {
    return `In your ${moduleContext.assignmentRef}, ${conceptLead} is not supported by explicit evidence, so the marker cannot clearly see how each claim is justified.`;
  }

  if (
    normalizedFeedback.includes("simplified") ||
    normalizedFeedback.includes("not precise") ||
    normalizedFeedback.includes("too simple")
  ) {
    return `In your ${moduleContext.assignmentRef}, ${conceptLead} lacks precision, especially in the more exact technical or analytical details the marker expects to see.`;
  }

  if (mode === "recovery") {
    return `In your ${moduleContext.moduleRef}, ${lowerCriterion} still needs a clearer fix against the rubric because the marker could not yet see the required reasoning or evidence.`;
  }

  return `In your ${moduleContext.assignmentRef}, ${lowerCriterion} is still weaker than your stronger areas because the marker could not clearly see the intended reasoning or evidence.`;
};

export const buildFeedbackLedIssue = (criterion: string, feedback: string | undefined, module: string, mode: GuidanceMode) => {
  if (!feedback) return buildIssue(criterion, module, mode);
  return buildIssueFromFeedback(criterion, feedback, module, mode) || buildIssue(criterion, module, mode);
};
