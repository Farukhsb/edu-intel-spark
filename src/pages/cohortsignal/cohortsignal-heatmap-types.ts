import type { ComponentType } from "react";

import type { CohortSignalRiskBand } from "@/pages/cohortsignal-demo/demoData";

export type HeatmapRiskBandMeta = Record<
  CohortSignalRiskBand,
  { label: string; shortLabel: string; className: string; icon: ComponentType<{ className?: string }> }
>;

export type HeatmapFilterState = {
  riskBand: CohortSignalRiskBand | "all";
  module: string;
  noInterventionLogged: boolean;
  decliningTrend: boolean;
  missingSubmission: boolean;
};

export type HeatmapBandReport = {
  holdoutAccuracy: number;
  crossValidation: { folds: number; accuracy: number; foldAccuracies: number[] };
};

export type HeatmapFailureReport = {
  holdoutAccuracy: number;
  crossValidation: { folds: number; accuracy: number; foldAccuracies: number[] };
  precision: number;
  recall: number;
  confusionMatrix: { truePositives: number; falsePositives: number; trueNegatives: number; falseNegatives: number };
};

