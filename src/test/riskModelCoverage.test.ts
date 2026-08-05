import { afterEach, describe, expect, it, vi } from "vitest";

import { mapRiskModelPredictionToAtRiskStudent, mapRiskModelPredictionToStudentRiskEvaluation } from "@/lib/riskModelMapping";
import { buildRiskRecommendation, buildReviewReasons, computeBoundarySoftening, computeConservatism, formatReviewReason } from "@/lib/riskModelReasons";
import type { RiskFeatureVector, RiskModelPrediction } from "@/lib/riskModelTypes";
import type { StudentTrajectory } from "@/lib/studentRisk";

const trajectory = (scores: number[]): StudentTrajectory => ({
  name: "Test Student",
  email: "student@example.com",
  studentId: "student-1",
  scores: scores.map((score, index) => ({
    score,
    date: `2026-01-0${index + 1}`,
    assignmentTitle: `Assignment ${index + 1}`,
  })),
});

const baseFeatures: RiskFeatureVector = {
  scoreCount: 4,
  average: 60,
  last: 58,
  minimum: 50,
  maximum: 80,
  slope: -1,
  predictedNext: 56,
  stdDev: 4,
  recent3Avg: 58,
  earlyAvg: 61,
  firstLastDelta: -2,
  recentDelta: -1,
  below50Ratio: 0,
  below40Ratio: 0,
  volatility: 4,
};

const prediction = (overrides: Partial<RiskModelPrediction> = {}): RiskModelPrediction => ({
  modelVersion: "risk-model-1",
  featureVersion: "trajectory-v1",
  generatedAt: "2026-06-23T00:00:00.000Z",
  className: "medium",
  riskBand: "medium",
  riskScore: 52,
  confidence: 0.81,
  confidenceScore: 0.81,
  needsReview: false,
  reviewReasons: [],
  probabilityByBand: { low: 0.2, medium: 0.5, high: 0.3 },
  featureVector: { ...baseFeatures },
  calibrationMetrics: {
    calibrationTemperature: 1.2,
    validationNll: 0.42,
    validationConfidenceEce: 0.08,
    trainAccuracy: 0.87,
    testAccuracy: 0.84,
  },
  advisoryOnly: true,
  ...overrides,
});

describe("risk model reasons and mapping", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unmock("@/lib/studentRiskLegacy");
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("formats all known review reasons and the fallback path", () => {
    expect(formatReviewReason("low_confidence")).toBe("Model confidence is low");
    expect(formatReviewReason("small_margin")).toBe("Top risk bands are close together");
    expect(formatReviewReason("short_history")).toBe("Assessment history is short");
    expect(formatReviewReason("volatile_pattern")).toBe("Performance pattern is volatile");
    expect(formatReviewReason("boundary_pattern")).toBe("Trajectory sits near a decision boundary");
    expect(formatReviewReason("near_threshold")).toBe("Trajectory is near the risk threshold");
    expect(formatReviewReason("sharp_decline")).toBe("Sharp decline detected");
    expect(formatReviewReason("mystery_signal")).toBe("Mystery Signal");
  });

  it("builds recommendations for each major risk branch", () => {
    expect(
      buildRiskRecommendation(
        prediction({
          reviewReasons: ["sharp_decline"],
          featureVector: { ...baseFeatures, slope: -4, average: 72, last: 44, predictedNext: 50 },
        }),
      ),
    ).toContain("Urgent");

    expect(
      buildRiskRecommendation(
        prediction({
          featureVector: { ...baseFeatures, average: 39, last: 41, predictedNext: 45 },
        }),
      ),
    ).toContain("student support services");

    expect(
      buildRiskRecommendation(
        prediction({
          featureVector: { ...baseFeatures, average: 62, last: 40, predictedNext: 50 },
        }),
      ),
    ).toContain("dipped sharply");

    expect(
      buildRiskRecommendation(
        prediction({
          featureVector: { ...baseFeatures, average: 62, last: 58, predictedNext: 38 },
        }),
      ),
    ).toContain("before the next deadline");

    expect(
      buildRiskRecommendation(
        prediction({
          reviewReasons: ["short_history"],
          featureVector: { ...baseFeatures, average: 62, last: 58, predictedNext: 52 },
        }),
      ),
    ).toContain("Data is limited");

    expect(buildRiskRecommendation(prediction())).toContain("Schedule a check-in");
  });

  it("computes conservatism, boundary softening, and review reasons", () => {
    const features: RiskFeatureVector = {
      scoreCount: 2,
      average: 55,
      last: 43,
      minimum: 20,
      maximum: 82,
      slope: -5,
      predictedNext: 56,
      stdDev: 18,
      recent3Avg: 44,
      earlyAvg: 67,
      firstLastDelta: -21,
      recentDelta: -12,
      below50Ratio: 0.5,
      below40Ratio: 0.25,
      volatility: 10,
    };

    expect(computeConservatism(features, [{ probability: 0.45 }, { probability: 0.38 }])).toBeGreaterThan(0);
    expect(computeBoundarySoftening(features)).toBeGreaterThan(0);
    expect(
      buildReviewReasons(features, [{ probability: 0.45 }, { probability: 0.38 }], 0.62),
    ).toEqual(
      expect.arrayContaining([
        "low_confidence",
        "small_margin",
        "short_history",
        "volatile_pattern",
        "boundary_pattern",
        "near_threshold",
        "sharp_decline",
      ]),
    );
  });

  it("maps model predictions to at-risk students and returns null for low scores", () => {
    const mapped = mapRiskModelPredictionToAtRiskStudent(
      trajectory([60, 58, 56, 54, 52, 50, 48]),
      prediction({
        riskScore: 76,
        reviewReasons: ["low_confidence", "sharp_decline"],
        featureVector: { ...baseFeatures, average: 52, last: 48, slope: -4, predictedNext: 39 },
      }),
    );

    expect(mapped).not.toBeNull();
    expect(mapped?.riskLevel).toBe("critical");
    expect(mapped?.reasonCodes).toEqual(["low_confidence", "sharp_decline"]);
    expect(mapped?.flags).toEqual(["Model confidence is low", "Sharp decline detected"]);
    expect(mapped?.recommendation).toContain("Urgent");
    expect(mapped?.predictedNext).toBe(39);
    expect(mapped?.sparkline).toEqual([58, 56, 54, 52, 50, 48]);

    expect(
      mapRiskModelPredictionToAtRiskStudent(
        trajectory([60, 58, 56]),
        prediction({ riskScore: 24 }),
      ),
    ).toBeNull();
  });

  it("maps predictions to student evaluations and falls back to baseline monitoring", () => {
    const evaluation = mapRiskModelPredictionToStudentRiskEvaluation(
      trajectory([70, 68, 66, 64]),
      prediction({
        reviewReasons: [],
        featureVector: { ...baseFeatures, average: 66, last: 64, predictedNext: 62 },
      }),
    );

    expect(evaluation).not.toBeNull();
    expect(evaluation?.reasonCodes).toEqual(["baseline_monitoring"]);
    expect(evaluation?.flags).toEqual([]);
    expect(evaluation?.explanation).toContain("Model risk 52.00%");

    expect(mapRiskModelPredictionToStudentRiskEvaluation(trajectory([70, 68]), null)).toBeNull();
  });

  it("delegates deprecated student risk wrappers and emits warnings outside test env", async () => {
    const evaluateLegacy = vi.fn().mockReturnValue({ legacy: "evaluation" });
    const computeLegacy = vi.fn().mockReturnValue({ legacy: "risk" });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.resetModules();
    vi.doMock("@/lib/studentRiskLegacy", () => ({
      evaluateStudentRiskLegacy: evaluateLegacy,
      computeRiskLegacy: computeLegacy,
    }));
    vi.stubEnv("NODE_ENV", "development");

    const { computeRisk: computeRiskWrapper, evaluateStudentRisk: evaluateWrapper } = await import("@/lib/studentRisk");

    expect(evaluateWrapper(trajectory([50, 48]))).toEqual({ legacy: "evaluation" });
    expect(computeRiskWrapper(trajectory([50, 48]))).toEqual({ legacy: "risk" });
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(evaluateLegacy).toHaveBeenCalledTimes(1);
    expect(computeLegacy).toHaveBeenCalledTimes(1);
  });
});
