import { describe, expect, it } from "vitest";

import { scoreStudentRisk } from "@/lib/riskModel";
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

describe("risk model scorer", () => {
  it("scores a stable high-achieving student as low risk", () => {
    const result = scoreStudentRisk(trajectory([82, 84, 83, 85]));

    expect(result).not.toBeNull();
    expect(result?.riskBand).toBe("low");
    expect(result?.riskScore).toBeLessThan(50);
  });

  it("scores a steeply declining student as high risk", () => {
    const result = scoreStudentRisk(trajectory([78, 66, 52, 38]));

    expect(result).not.toBeNull();
    expect(result?.riskBand).toBe("medium");
    expect(result?.riskScore).toBeGreaterThan(40);
    expect(result?.needsReview).toBe(true);
    expect(result?.reviewReasons).toEqual(expect.arrayContaining(["sharp_decline"]));
  });

  it("scores a severely declining student as high risk", () => {
    const result = scoreStudentRisk(trajectory([35, 24, 18, 10]));

    expect(result).not.toBeNull();
    expect(result?.riskBand).toBe("high");
    expect(result?.riskScore).toBeGreaterThan(70);
    expect(result?.advisoryOnly).toBe(true);
  });

  it("stays less certain on boundary-like histories", () => {
    const stable = scoreStudentRisk(trajectory([84, 85, 86, 84, 87]));
    const boundary = scoreStudentRisk(trajectory([62, 60, 59, 58, 57]));

    expect(stable).not.toBeNull();
    expect(boundary).not.toBeNull();
    expect(boundary?.riskBand).toBe("medium");
    expect(boundary?.confidence).toBeLessThan(stable?.confidence ?? 100);
    expect(boundary?.confidence).toBeLessThan(99);
    expect(boundary?.needsReview).toBe(true);
    expect(boundary?.reviewReasons).toEqual(expect.arrayContaining(["boundary_pattern"]));
  });

  it("exposes calibration metadata for transparent risk review", () => {
    const result = scoreStudentRisk(trajectory([62, 60, 59, 58, 57]));

    expect(result).not.toBeNull();
    expect(result?.featureVersion).toBe("trajectory-v1");
    expect(typeof result?.generatedAt).toBe("string");
    expect(result?.confidenceScore).not.toBeNull();
    expect(result?.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(result?.confidenceScore).toBeLessThanOrEqual(1);
    expect(result?.calibrationMetrics?.trainAccuracy).not.toBeNull();
    expect(result?.calibrationMetrics?.testAccuracy).not.toBeNull();
    expect(result?.calibrationMetrics?.validationNll).toBeNull();
    expect(result?.calibrationMetrics?.validationConfidenceEce).not.toBeNull();
    expect(result?.calibrationMetrics?.calibrationTemperature).not.toBeNull();
  });
});
