export type RiskModelClassName = "low" | "medium" | "high";

export interface RiskModelArtifact {
  enabled: boolean;
  version: string;
  trainedAt: string;
  calibrationTemperature?: number;
  featureNames: string[];
  classNames: RiskModelClassName[];
  featureMeans: number[];
  featureStdDevs: number[];
  weights: number[][];
  biases: number[];
  metrics?: {
    trainAccuracy: number;
    testAccuracy: number;
    trainingExamples: number;
    testExamples: number;
    source?: string;
    calibrationTemperature?: number;
    validationNll?: number;
    validationConfidenceEce?: number;
  };
}
