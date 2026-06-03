import { describe, expect, it } from "vitest";

import { evaluateRiskPredictions } from "../../tools/risk-model/evaluation-core.mjs";

describe("risk evaluation metrics", () => {
  it("computes multiclass metrics and calibration", () => {
    const summary = evaluateRiskPredictions([
      { actualBand: "low", predictedBand: "low", confidence: 0.18 },
      { actualBand: "medium", predictedBand: "medium", confidence: 0.68 },
      { actualBand: "high", predictedBand: "high", confidence: 0.91 },
      { actualBand: "low", predictedBand: "high", confidence: 0.72 },
    ]);

    expect(summary.count).toBe(4);
    expect(summary.accuracy).toBe(0.75);
    expect(summary.perClass.high.recall).toBe(1);
    expect(summary.perClass.low.precision).toBe(1);
    expect(summary.confusionMatrix.low.high).toBe(1);
    expect(summary.calibration.positiveClass).toBe("high");
    expect(summary.calibration.brierScore).toBeGreaterThan(0);
  });
});

