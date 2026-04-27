import { describe, expect, it } from "vitest";
import { computeRisk, type StudentTrajectory } from "@/lib/studentRisk";

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

describe("student risk support signals", () => {
  it("flags a student with an average below 40% for high support", () => {
    const result = computeRisk(trajectory([35, 36, 37]));

    expect(result).not.toBeNull();
    expect(result?.avgGrade).toBe(36);
    expect(result?.riskLevel).toBe("high");
    expect(result?.flags).toContain("Average below 40%");
    expect(result?.recommendation).toContain("student support services");
  });

  it("adds a decline-related support reason for a steep grade decline", () => {
    const result = computeRisk(trajectory([78, 66, 52, 38]));

    expect(result).not.toBeNull();
    expect(result?.trend).toBe("declining");
    expect(result?.flags).toContain("Steep grade decline");
    expect(result?.recommendation).toContain("grade trajectory");
  });

  it("treats one graded submission as limited data without over-interpreting trend", () => {
    const result = computeRisk(trajectory([45]));

    expect(result).not.toBeNull();
    expect(result?.riskLevel).toBe("moderate");
    expect(result?.flags).toContain("Average below 50%");
    expect(result?.flags).toContain("Only 1 submission graded");
    expect(result?.flags).not.toContain("Steep grade decline");
    expect(result?.flags).not.toContain("Gradual grade decline");
    expect(result?.flags.some((flag) => flag.startsWith("Expected next outcome"))).toBe(false);
    expect(result?.recommendation).toContain("Data is limited");
  });

  it("does not flag a stable student with acceptable grades as high support", () => {
    const result = computeRisk(trajectory([64, 66, 65, 67]));

    expect(result).toBeNull();
  });

  it("uses softer visible support wording for expected outcomes and recommendations", () => {
    const result = computeRisk(trajectory([42, 37, 31]));
    const visibleText = [...(result?.flags ?? []), result?.recommendation ?? ""].join(" ");

    expect(result).not.toBeNull();
    expect(visibleText).toContain("Expected next outcome");
    expect(visibleText).toContain("support");
    expect(visibleText).not.toContain("Predicted next");
    expect(visibleText).not.toContain("Predicted to fail");
    expect(visibleText).not.toContain("Intervene before the next deadline");
  });
});
