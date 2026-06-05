import { describe, expect, it } from "vitest";

import {
  buildRiskModelTrainingExamples,
  scoreRiskModelArtifact,
  trainRiskModelArtifact,
} from "@/lib/riskModelPipeline";

const lowFeatures = {
  scoreCount: 5,
  average: 84,
  last: 86,
  minimum: 81,
  maximum: 88,
  slope: 1,
  predictedNext: 87,
  stdDev: 2,
  recent3Avg: 85,
  earlyAvg: 83,
  firstLastDelta: 2,
  recentDelta: 1,
  below50Ratio: 0,
  below40Ratio: 0,
};

const mediumFeatures = {
  scoreCount: 4,
  average: 58,
  last: 55,
  minimum: 50,
  maximum: 65,
  slope: -1.5,
  predictedNext: 52,
  stdDev: 5,
  recent3Avg: 56,
  earlyAvg: 60,
  firstLastDelta: -3,
  recentDelta: -2,
  below50Ratio: 0.25,
  below40Ratio: 0,
};

const highFeatures = {
  scoreCount: 4,
  average: 34,
  last: 28,
  minimum: 22,
  maximum: 46,
  slope: -7,
  predictedNext: 24,
  stdDev: 9,
  recent3Avg: 29,
  earlyAvg: 42,
  firstLastDelta: -18,
  recentDelta: -9,
  below50Ratio: 1,
  below40Ratio: 0.75,
};

describe("risk model pipeline", () => {
  it("builds training examples from prediction and outcome rows", () => {
    const examples = buildRiskModelTrainingExamples({
      predictions: [
        {
          id: "pred-low",
          student_id: "student-low",
          prediction_date: "2026-05-01",
          model_version: "bootstrap",
          risk_score: 18,
          risk_band: "low",
          details: { model_feature_vector: lowFeatures },
        },
        {
          id: "pred-med",
          student_id: "student-med",
          prediction_date: "2026-05-01",
          model_version: "bootstrap",
          risk_score: 52,
          risk_band: "medium",
          details: { model_feature_vector: mediumFeatures },
        },
        {
          id: "pred-high",
          student_id: "student-high",
          prediction_date: "2026-05-01",
          model_version: "bootstrap",
          risk_score: 88,
          risk_band: "high",
          details: { model_feature_vector: highFeatures },
        },
      ],
      outcomes: [
        {
          prediction_id: "pred-low",
          student_id: "student-low",
          outcome_date: "2026-05-20",
          label_value: "low",
          label_window_days: 30,
        },
        {
          prediction_id: "pred-med",
          student_id: "student-med",
          outcome_date: "2026-05-20",
          label_value: "medium",
          label_window_days: 30,
        },
        {
          prediction_id: "pred-high",
          student_id: "student-high",
          outcome_date: "2026-05-20",
          label_value: "high",
          label_window_days: 30,
        },
      ],
    });

    expect(examples).toHaveLength(3);
    expect(examples.map((example) => example.label)).toEqual(["low", "medium", "high"]);
    expect(examples[0]?.features.average).toBe(84);
  });

  it("trains an artifact that ranks a steep decline as high risk", () => {
    const trainingExamples = [
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `low-${index}`,
        studentId: `low-${index}`,
        observedAt: `2026-05-${String(index + 1).padStart(2, "0")}`,
        label: "low" as const,
        features: lowFeatures,
        source: "prediction_outcome" as const,
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `medium-${index}`,
        studentId: `medium-${index}`,
        observedAt: `2026-05-${String(index + 5).padStart(2, "0")}`,
        label: "medium" as const,
        features: mediumFeatures,
        source: "prediction_outcome" as const,
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `high-${index}`,
        studentId: `high-${index}`,
        observedAt: `2026-05-${String(index + 9).padStart(2, "0")}`,
        label: "high" as const,
        features: highFeatures,
        source: "prediction_outcome" as const,
      })),
    ];

    const artifact = trainRiskModelArtifact(trainingExamples);
    expect(artifact).not.toBeNull();
    expect(artifact?.version).toBe("historical-outcomes-v1");
    expect(artifact?.metrics?.source).toBe("historical_outcomes");
    expect((artifact?.metrics?.trainAccuracy ?? 0)).toBeGreaterThanOrEqual(0.5);
    expect((artifact?.metrics?.testAccuracy ?? 0)).toBeGreaterThanOrEqual(0.5);

    const scoredLow = scoreRiskModelArtifact(artifact!, lowFeatures);
    const scoredHigh = scoreRiskModelArtifact(artifact!, highFeatures);

    expect(scoredHigh.primary.className).toBe("high");
    expect(scoredHigh.probabilityByBand.high).toBeGreaterThan(scoredLow.probabilityByBand.high);
  });
});
