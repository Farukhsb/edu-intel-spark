export type RiskBand = "low" | "medium" | "high";

export type RiskEvaluationRow = {
  actualBand: RiskBand;
  predictedBand: RiskBand;
  confidence: number;
};

export type RiskCalibrationBin = {
  lowerBound: number;
  upperBound: number;
  count: number;
  averageConfidence: number;
  observedPositiveRate: number;
  calibrationGap: number;
};

export type RiskEvaluationSummary = {
  count: number;
  accuracy: number;
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  perClass: Record<
    RiskBand,
    {
      precision: number;
      recall: number;
      f1: number;
      support: number;
    }
  >;
  confusionMatrix: Record<RiskBand, Record<RiskBand, number>>;
  calibration: {
    positiveClass: RiskBand;
    brierScore: number;
    expectedCalibrationError: number;
    bins: RiskCalibrationBin[];
  };
  confidenceCalibration: {
    positiveClass: "correct";
    brierScore: number;
    expectedCalibrationError: number;
    bins: RiskCalibrationBin[];
  };
};

export function normalizeConfidence(value: number): number;
export function evaluateRiskPredictions(
  rows: RiskEvaluationRow[],
  options?: {
    positiveClass?: RiskBand;
    binCount?: number;
  },
): RiskEvaluationSummary;
