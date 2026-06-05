import { riskModelArtifact as bootstrapRiskModelArtifact } from "./riskModelArtifact.ts";
import type { RiskModelArtifact } from "./riskModelArtifactTypes.ts";

let activeRiskModelArtifact: RiskModelArtifact = bootstrapRiskModelArtifact;

export const normalizeRiskModelArtifact = (value: unknown): RiskModelArtifact | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<RiskModelArtifact>;
  if (
    typeof candidate.enabled !== "boolean" ||
    typeof candidate.version !== "string" ||
    typeof candidate.trainedAt !== "string" ||
    !Array.isArray(candidate.classNames) ||
    !Array.isArray(candidate.featureNames) ||
    !Array.isArray(candidate.featureMeans) ||
    !Array.isArray(candidate.featureStdDevs) ||
    !Array.isArray(candidate.weights) ||
    !Array.isArray(candidate.biases)
  ) {
    return null;
  }
  return candidate as RiskModelArtifact;
};

export const getRiskModelArtifact = () => activeRiskModelArtifact;

export const setRiskModelArtifact = (artifact: RiskModelArtifact | null | undefined) => {
  activeRiskModelArtifact = artifact ?? bootstrapRiskModelArtifact;
  return activeRiskModelArtifact;
};

export const resetRiskModelArtifact = () => {
  activeRiskModelArtifact = bootstrapRiskModelArtifact;
  return activeRiskModelArtifact;
};

export const isBootstrapRiskModelArtifact = () => activeRiskModelArtifact.version === bootstrapRiskModelArtifact.version;
