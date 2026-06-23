import type { RiskModelArtifact } from "@/lib/riskModelArtifactTypes";
import { getRiskModelArtifact } from "@/lib/riskModelRegistry";
import { scoreRiskModelArtifact } from "@/lib/riskModelPipelineScoring";
import type { RiskModelPrediction } from "@/lib/riskModelTypes";
import { extractRiskFeatures } from "@/lib/riskModelFeatures";
import { buildReviewReasons, computeBoundarySoftening, computeConservatism } from "@/lib/riskModelReasons";
import { clamp } from "@/lib/riskModelPipelineShared";
import type { StudentTrajectory } from "@/lib/studentRisk";

export function scoreStudentRisk(
  trajectory: StudentTrajectory,
  options?: {
    featureVersion?: string;
    generatedAt?: string;
  },
): RiskModelPrediction | null {
  const riskModelArtifact = getRiskModelArtifact();
  if (!riskModelArtifact?.enabled) return null;

  const features = extractRiskFeatures(trajectory);
  const scoring = scoreRiskModelArtifact(riskModelArtifact, features);
  const baseProbabilities = scoring.baseProbabilities;
  const ranked = scoring.ranked;
  const conservatism = computeConservatism(features, ranked);
  const probabilities = blendWithUniform(baseProbabilities, conservatism);
  const boundarySoftening = computeBoundarySoftening(features);
  const finalProbabilities = blendWithUniform(probabilities, boundarySoftening);
  const primary = scoring.primary;
  const primaryIndex = riskModelArtifact.classNames.indexOf(primary.className);
  const primaryProbability = finalProbabilities[primaryIndex] ?? primary.probability;

  const probabilityByBand = {
    low: finalProbabilities[riskModelArtifact.classNames.indexOf("low")] ?? 0,
    medium: finalProbabilities[riskModelArtifact.classNames.indexOf("medium")] ?? 0,
    high: finalProbabilities[riskModelArtifact.classNames.indexOf("high")] ?? 0,
  };
  const baseProbabilityByBand = scoring.probabilityByBand;

  const riskScore = clamp(
    baseProbabilityByBand.low * 15 + baseProbabilityByBand.medium * 55 + baseProbabilityByBand.high * 90,
    0,
    100,
  );
  const confidenceProbability = Math.min(Math.max(primaryProbability, 0), 1);
  const reviewReasons = buildReviewReasons(features, ranked, confidenceProbability);
  const needsReview = reviewReasons.length > 0;

  return {
    modelVersion: riskModelArtifact.version,
    featureVersion: options?.featureVersion ?? "trajectory-v1",
    generatedAt: options?.generatedAt ?? new Date().toISOString(),
    className: primary.className,
    riskBand: primary.className,
    riskScore: Number(riskScore.toFixed(2)),
    confidence: Number((confidenceProbability * 100).toFixed(2)),
    confidenceScore: Number(confidenceProbability.toFixed(4)),
    needsReview,
    reviewReasons,
    probabilityByBand,
    featureVector: features,
    calibrationMetrics: {
      calibrationTemperature: riskModelArtifact.calibrationTemperature ?? null,
      validationNll: riskModelArtifact.metrics?.validationNll ?? null,
      validationConfidenceEce: riskModelArtifact.metrics?.validationConfidenceEce ?? null,
      trainAccuracy: riskModelArtifact.metrics?.trainAccuracy ?? null,
      testAccuracy: riskModelArtifact.metrics?.testAccuracy ?? null,
    },
    advisoryOnly: true,
  };
}

function blendWithUniform(probabilities: number[], blendFactor: number): number[] {
  const safeBlend = clamp(blendFactor, 0, 1);
  const uniform = 1 / Math.max(1, probabilities.length);
  return probabilities.map((probability) => probability * (1 - safeBlend) + uniform * safeBlend);
}
