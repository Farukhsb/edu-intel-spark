import type { RiskModelClassName } from "@/lib/riskModelArtifactTypes";

export type RiskModelFeatureMap = Record<string, number>;

export type RiskModelTrainingExample = {
  id: string;
  studentId: string;
  observedAt: string;
  label: RiskModelClassName;
  features: RiskModelFeatureMap;
  source: "prediction_outcome" | "aligned_outcome";
};

export type RiskModelTrainingDataset = {
  predictions: Array<{
    id: string;
    student_id: string;
    prediction_date: string;
    model_version: string;
    risk_score: number | string;
    risk_band: string;
    details: unknown | null;
  }>;
  outcomes: Array<{
    prediction_id: string | null;
    student_id: string;
    outcome_date: string;
    label_value: string;
    label_window_days: number;
  }>;
};

export type RiskModelScoringResult = {
  logits: number[];
  baseProbabilities: number[];
  probabilities: number[];
  ranked: Array<{ className: RiskModelClassName; probability: number }>;
  primary: { className: RiskModelClassName; probability: number };
  probabilityByBand: Record<RiskModelClassName, number>;
};

export type RiskModelSplit = {
  train: RiskModelTrainingExample[];
  validation: RiskModelTrainingExample[];
};
