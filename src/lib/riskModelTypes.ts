import type { AtRiskStudent, StudentRiskEvaluation } from "@/lib/studentRisk";
import type { RiskModelClassName } from "@/lib/riskModelArtifactTypes";

export const RISK_FEATURE_VERSION = "trajectory-v1";

export type RiskModelPrediction = {
  modelVersion: string;
  featureVersion: string;
  generatedAt: string;
  className: RiskModelClassName;
  riskBand: RiskModelClassName;
  riskScore: number;
  confidence: number;
  confidenceScore: number;
  needsReview: boolean;
  reviewReasons: string[];
  probabilityByBand: Record<RiskModelClassName, number>;
  featureVector: Record<string, number>;
  calibrationMetrics: {
    calibrationTemperature: number | null;
    validationNll: number | null;
    validationConfidenceEce: number | null;
    trainAccuracy: number | null;
    testAccuracy: number | null;
  };
  advisoryOnly: true;
};

export type RiskFeatureName =
  | "scoreCount"
  | "average"
  | "last"
  | "minimum"
  | "maximum"
  | "slope"
  | "predictedNext"
  | "stdDev"
  | "recent3Avg"
  | "earlyAvg"
  | "firstLastDelta"
  | "recentDelta"
  | "below50Ratio"
  | "below40Ratio";

export type RiskFeatureVector = Record<RiskFeatureName, number> & {
  volatility: number;
};

export type RiskModelReviewReason =
  | "low_confidence"
  | "small_margin"
  | "short_history"
  | "volatile_pattern"
  | "boundary_pattern"
  | "near_threshold"
  | "sharp_decline";

export type RiskModelPredictionMapperInput = {
  name: string;
  email: string;
  studentId: string;
  scores: Array<{
    score: number;
    date: string;
    assignmentTitle: string;
  }>;
};

export type RiskModelAtRiskStudent = AtRiskStudent;
export type RiskModelEvaluation = StudentRiskEvaluation;
