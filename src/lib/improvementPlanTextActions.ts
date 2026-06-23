import type { GuidanceMode } from "@/lib/improvementPlanTypes";

import { buildConceptObjectPhrase, normalizeCriterionLabel, normalizeFeedbackText } from "@/lib/improvementPlanTextCore";

export const buildActionItems = (
  criterion: string,
  feedback: string | undefined,
  mode: GuidanceMode,
  conceptHint: string | null,
) => {
  const normalized = criterion.toLowerCase();
  const normalizedFeedback = (feedback ?? "").toLowerCase();
  const futurePrefix = "For future assignments, ";
  const recoveryPrefix = "For resubmission, ";
  const prefix = mode === "recovery" ? recoveryPrefix : futurePrefix;
  const conceptObject = buildConceptObjectPhrase(conceptHint, criterion);

  if (
    normalizedFeedback.includes("descriptive") ||
    normalizedFeedback.includes("not evaluative") ||
    normalizedFeedback.includes("does not clearly evaluate")
  ) {
    return [
      `${prefix}rewrite ${conceptObject} so it compares at least two viewpoints rather than describing only one position`,
      `${prefix}include one concrete example or case that shows the issue in practice`,
      `${prefix}end the section with a clear judgement so your position is explicit`,
    ];
  }

  if (
    normalizedFeedback.includes("no visible test") ||
    normalizedFeedback.includes("visible testing") ||
    normalizedFeedback.includes("output evidence") ||
    normalizedFeedback.includes("test output")
  ) {
    return [
      `${prefix}add operation outputs or screenshots that show ${conceptObject} working`,
      `${prefix}include at least one edge case alongside the normal path`,
      `${prefix}show the final traversal, sorted output, or resulting state so correctness is visible`,
    ];
  }

  if (
    normalizedFeedback.includes("supports claims weakly") ||
    normalizedFeedback.includes("evidence supports") ||
    normalizedFeedback.includes("textual support")
  ) {
    return [
      `${prefix}add 2 stronger quotes or examples that directly support ${conceptObject}`,
      `${prefix}explain exactly what each quote proves rather than leaving it implicit`,
      `${prefix}link each piece of evidence directly back to the claim it supports`,
    ];
  }

  if (normalized.includes("complexity")) {
    return [
      `${prefix}rewrite the time and space complexity for ${conceptObject}`,
      `${prefix}separate average-case from worst-case behaviour`,
      `${prefix}justify each complexity claim against the actual data structure behaviour`,
    ];
  }

  if (normalized.includes("test")) {
    return [
      `${prefix}add operation outputs that demonstrate ${conceptObject}`,
      `${prefix}include at least one edge case`,
      `${prefix}show the final traversal or end-state so correctness is visible`,
    ];
  }

  if (normalized.includes("evidence")) {
    return [
      `${prefix}add 2 stronger quotes or examples for ${conceptObject}`,
      `${prefix}explain exactly what each quote proves`,
      `${prefix}link each piece of evidence directly back to the claim it supports`,
    ];
  }

  if (normalized.includes("analysis") || normalized.includes("comparison")) {
    return [
      `${prefix}rewrite ${conceptObject} so it includes two viewpoints or options being compared`,
      `${prefix}use at least one academic source or supporting concept`,
      `${prefix}finish with a clear judgement, not just description`,
    ];
  }

  if (normalized.includes("dynamic programming")) {
    return [
      `${prefix}state the recurrence relation for ${conceptObject} before coding`,
      `${prefix}show one worked example of the subproblems combining`,
      `${prefix}explain why the chosen state representation is correct`,
    ];
  }

  if (normalized.includes("report") || normalized.includes("quality") || normalized.includes("overall")) {
    return [
      `${prefix}use the rubric as a final checklist`,
      `${prefix}make sure every required section includes visible evidence`,
      `${prefix}end with a clear conclusion or judgement rather than stopping at description`,
    ];
  }

  return [
    `${prefix}review the rubric wording for ${normalizeCriterionLabel(criterion)}`,
    `${prefix}rewrite one weaker section so the intended reasoning is explicit`,
    `${prefix}add a visible example or explanation the marker can directly verify`,
  ];
};

export const buildEvidenceOfImprovement = (criterion: string, feedback: string | undefined, mode: GuidanceMode) => {
  const normalized = criterion.toLowerCase();
  const normalizedFeedback = (feedback ?? "").toLowerCase();
  const timeframe =
    mode === "recovery"
      ? "This will help the resubmission meet the rubric minimums more clearly."
      : "This will strengthen the same skill on future assignments.";

  if (
    normalizedFeedback.includes("descriptive") ||
    normalizedFeedback.includes("not evaluative") ||
    normalizedFeedback.includes("does not clearly evaluate")
  ) {
    return `The marker can clearly see evaluation rather than description and can identify your final position. ${timeframe}`;
  }

  if (
    normalizedFeedback.includes("no visible test") ||
    normalizedFeedback.includes("visible testing") ||
    normalizedFeedback.includes("output evidence") ||
    normalizedFeedback.includes("test output")
  ) {
    return `The marker can verify correctness directly from visible outputs, edge-case evidence, and the final program state. ${timeframe}`;
  }

  if (
    normalizedFeedback.includes("supports claims weakly") ||
    normalizedFeedback.includes("evidence supports") ||
    normalizedFeedback.includes("textual support")
  ) {
    return `Each claim is backed by explicit textual or source-based support rather than unsupported assertion. ${timeframe}`;
  }

  if (normalized.includes("complexity")) {
    return `Marker can clearly see that each complexity claim is justified and that the higher-risk cases have been evaluated properly. ${timeframe}`;
  }

  if (normalized.includes("test")) {
    return `Marker can verify correctness directly from visible outputs, an edge case, and the final state of the program. ${timeframe}`;
  }

  if (normalized.includes("evidence")) {
    return `Each claim is backed by explicit textual or source-based support, not just assertion. ${timeframe}`;
  }

  if (normalized.includes("analysis") || normalized.includes("comparison")) {
    return `Marker can clearly see comparison, evaluation, and a defended final judgement rather than description alone. ${timeframe}`;
  }

  if (normalized.includes("dynamic programming")) {
    return `Marker can follow the recurrence, the worked example, and the logic connecting subproblems to the final answer. ${timeframe}`;
  }

  if (normalized.includes("report") || normalized.includes("quality") || normalized.includes("overall")) {
    return `Marker can clearly see that every required section contains evidence, explanation, and a complete final response. ${timeframe}`;
  }

  return `Marker can directly see the missing reasoning or evidence that was previously only implied. ${timeframe}`;
};
