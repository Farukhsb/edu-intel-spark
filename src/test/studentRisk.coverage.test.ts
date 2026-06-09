import { describe, expect, it } from "vitest";

import { computeRisk, evaluateStudentRisk, type StudentTrajectory } from "@/lib/studentRisk";

const trajectory = (scores: number[], dates?: string[]): StudentTrajectory => ({
  name: "Test Student",
  email: "student@example.com",
  studentId: "student-1",
  scores: scores.map((score, index) => ({
    score,
    date: dates?.[index] ?? `2026-01-0${index + 1}`,
    assignmentTitle: `Assignment ${index + 1}`,
  })),
});

describe("studentRisk coverage", () => {
  it("returns null when there are no scores", () => {
    expect(evaluateStudentRisk(trajectory([]))).toBeNull();
    expect(computeRisk(trajectory([]))).toBeNull();
  });

  it("covers gradual decline, recent drop, and baseline recommendation branches", () => {
    const gradual = evaluateStudentRisk(trajectory([70, 68, 66, 64]));
    const recentDrop = evaluateStudentRisk(trajectory([80, 80, 40]));
    const baseline = evaluateStudentRisk(trajectory([64, 66, 65, 67]), {
      referenceDate: "2026-01-05T00:00:00Z",
      staleWindowDays: 30,
    });

    expect(gradual).not.toBeNull();
    expect(gradual?.reasonCodes).toContain("gradual_grade_decline");
    expect(gradual?.flags).toContain("Gradual grade decline");

    expect(recentDrop).not.toBeNull();
    expect(recentDrop?.reasonCodes).toContain("recent_grade_drop");
    expect(recentDrop?.flags).toContain("Sudden drop in last grade");

    expect(baseline).not.toBeNull();
    expect(baseline?.reasonCodes).toContain("baseline_monitoring");
    expect(baseline?.recommendation).toContain("Schedule a check-in");
  });

  it("covers high variance, stale data, and invalid date handling", () => {
    const highVariance = evaluateStudentRisk(trajectory([100, 0, 100]));
    const stale = evaluateStudentRisk(trajectory([42, 37, 31]), {
      referenceDate: "2026-03-15T00:00:00Z",
      staleWindowDays: 14,
    });
    const invalidDates = evaluateStudentRisk(trajectory([45, 40], ["not-a-date", ""]));

    expect(highVariance).not.toBeNull();
    expect(highVariance?.reasonCodes).toContain("high_variance");
    expect(highVariance?.flags).toContain("Highly inconsistent grades");

    expect(stale).not.toBeNull();
    expect(stale?.reasonCodes).toContain("stale_data");
    expect(stale?.recommendation).toContain("evidence is stale");

    expect(invalidDates).not.toBeNull();
    expect(invalidDates?.reasonCodes).toContain("average_below_50");
    expect(invalidDates?.flags).toContain("Average below 50%");
  });

  it("covers the limited-history and low-risk computeRisk branches", () => {
    const limitedHistory = evaluateStudentRisk(trajectory([45]));
    const lowRisk = computeRisk(trajectory([64, 66, 65, 67]));

    expect(limitedHistory).not.toBeNull();
    expect(limitedHistory?.reasonCodes).toContain("limited_history");
    expect(limitedHistory?.flags).toContain("Average below 50%");
    expect(limitedHistory?.flags).toContain("Only 1 submission graded");

    expect(lowRisk).toBeNull();
  });
});
