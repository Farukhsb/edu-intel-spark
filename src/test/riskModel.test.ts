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
});
