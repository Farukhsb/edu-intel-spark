import type { RiskModelArtifact } from "@/lib/riskModelArtifactTypes";
import type { RiskModelFeatureMap, RiskModelScoringResult } from "@/lib/riskModelPipelineTypes";
import { applyTemperatureScaling, normalizeFeatures, softmax } from "@/lib/riskModelPipelineShared";

function scoreLinearArtifact(artifact: RiskModelArtifact, features: RiskModelFeatureMap): RiskModelScoringResult {
  const normalized = normalizeFeatures(artifact, features);
  const logits = artifact.classNames.map((_, classIndex) => {
    const weights = (artifact.weights[classIndex] ?? []) as number[];
    const bias = artifact.biases[classIndex] ?? 0;
    return weights.reduce((sum, weight, featureIndex) => sum + weight * (normalized[featureIndex] ?? 0), bias);
  });

  const baseProbabilities = softmax(applyTemperatureScaling(logits, artifact.calibrationTemperature));
  const ranked = artifact.classNames
    .map((className, index) => ({ className, probability: baseProbabilities[index] ?? 0 }))
    .sort((left, right) => right.probability - left.probability);

  return {
    logits,
    baseProbabilities,
    probabilities: baseProbabilities,
    ranked,
    primary: ranked[0] ?? { className: "low", probability: 1 / 3 },
    probabilityByBand: {
      low: baseProbabilities[artifact.classNames.indexOf("low")] ?? 0,
      medium: baseProbabilities[artifact.classNames.indexOf("medium")] ?? 0,
      high: baseProbabilities[artifact.classNames.indexOf("high")] ?? 0,
    },
  };
}

export function scoreRiskModelArtifact(artifact: RiskModelArtifact, features: RiskModelFeatureMap) {
  return scoreLinearArtifact(artifact, features);
}
