import type { RiskFeatureVector, RiskModelPrediction, RiskModelReviewReason } from "@/lib/riskModelTypes";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function formatReviewReason(reason: RiskModelReviewReason | string) {
  switch (reason) {
    case "low_confidence":
      return "Model confidence is low";
    case "small_margin":
      return "Top risk bands are close together";
    case "short_history":
      return "Assessment history is short";
    case "volatile_pattern":
      return "Performance pattern is volatile";
    case "boundary_pattern":
      return "Trajectory sits near a decision boundary";
    case "near_threshold":
      return "Trajectory is near the risk threshold";
    case "sharp_decline":
      return "Sharp decline detected";
    default:
      return reason.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

export function buildRiskRecommendation(prediction: RiskModelPrediction): string {
  const average = prediction.featureVector.average ?? 0;
  const last = prediction.featureVector.last ?? 0;
  const slope = prediction.featureVector.slope ?? 0;
  const predictedNext = prediction.featureVector.predictedNext ?? 0;

  if (prediction.reviewReasons.includes("sharp_decline") || slope < -3) {
    return "Urgent: schedule a 1-on-1 meeting to discuss grade trajectory.";
  }
  if (average < 40) {
    return "Refer to student support services and consider tutoring.";
  }
  if (last < average - 15) {
    return "Recent performance dipped sharply. Check for academic or personal barriers.";
  }
  if (predictedNext < 40) {
    return "The current assessment pattern suggests this student may need support before the next deadline.";
  }
  if (prediction.reviewReasons.includes("short_history") || prediction.reviewReasons.includes("low_confidence")) {
    return "Data is limited. Monitor closely after the next submission.";
  }

  return "Schedule a check-in to review study strategies and agree short-term goals.";
}

export function computeConservatism(features: RiskFeatureVector, ranked: { probability: number }[]) {
  const topProbability = ranked[0]?.probability ?? 0;
  const secondProbability = ranked[1]?.probability ?? 0;
  const margin = clamp(topProbability - secondProbability, 0, 1);

  const marginPenalty = clamp((0.5 - margin) / 0.5, 0, 1);
  const historyPenalty = clamp((5 - features.scoreCount) / 5, 0, 1);
  const volatilityPenalty = clamp((features.volatility - 5) / 12, 0, 1);
  const boundaryAveragePenalty = clamp(1 - Math.abs(features.average - 55) / 11, 0, 1);
  const boundaryTrendPenalty = clamp(1 - Math.abs(features.predictedNext - 55) / 13, 0, 1);
  const boundaryPenalty = boundaryAveragePenalty * 0.6 + boundaryTrendPenalty * 0.4;

  return clamp(
    marginPenalty * 0.35 + historyPenalty * 0.15 + volatilityPenalty * 0.15 + boundaryPenalty * 0.35,
    0,
    0.8,
  );
}

export function computeBoundarySoftening(features: RiskFeatureVector): number {
  const boundaryAveragePenalty = clamp(1 - Math.abs(features.average - 55) / 9, 0, 1);
  const boundaryTrendPenalty = clamp(1 - Math.abs(features.predictedNext - 55) / 11, 0, 1);
  const shortHistoryPenalty = clamp((5 - features.scoreCount) / 5, 0, 1);
  const volatilityPenalty = clamp((features.volatility - 4) / 10, 0, 1);

  return clamp(
    boundaryAveragePenalty * 0.35 +
      boundaryTrendPenalty * 0.25 +
      shortHistoryPenalty * 0.2 +
      volatilityPenalty * 0.2,
    0,
    0.4,
  );
}

export function buildReviewReasons(
  features: RiskFeatureVector,
  ranked: { probability: number }[],
  confidenceProbability: number,
): string[] {
  const reasons = new Set<string>();
  const topProbability = ranked[0]?.probability ?? 0;
  const secondProbability = ranked[1]?.probability ?? 0;
  const margin = clamp(topProbability - secondProbability, 0, 1);
  const boundarySoftening = computeBoundarySoftening(features);

  if (confidenceProbability < 0.7) reasons.add("low_confidence");
  if (margin < 0.18) reasons.add("small_margin");
  if (features.scoreCount < 3) reasons.add("short_history");
  if (features.volatility >= 9.5) reasons.add("volatile_pattern");
  if (boundarySoftening >= 0.35) reasons.add("boundary_pattern");
  if (Math.abs(features.average - 55) <= 5 || Math.abs(features.predictedNext - 55) <= 5) {
    reasons.add("near_threshold");
  }
  if (
    features.slope <= -4 ||
    features.recentDelta <= -10 ||
    features.firstLastDelta <= -18 ||
    features.below40Ratio >= 0.25
  ) {
    reasons.add("sharp_decline");
  }

  return Array.from(reasons);
}
