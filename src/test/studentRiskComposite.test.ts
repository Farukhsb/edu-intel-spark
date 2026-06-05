import { describe, expect, it } from "vitest";

import { evaluateStudentRisk, type StudentTrajectory } from "@/lib/studentRisk";
import { evaluateCompositeStudentRisk } from "@/lib/studentRiskComposite";

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

describe("student composite risk scoring", () => {
  it("raises risk when academic decline combines with missing submissions and no engagement", () => {
    const academic = evaluateStudentRisk(trajectory([42, 35, 31]));
    const composite = evaluateCompositeStudentRisk({
      academicEvaluation: academic,
      engagement: { eventCount: 0, lastEventAt: null },
      submissions: { totalAssignments: 5, submittedAssignments: 0, lateSubmissions: 0 },
      referenceDate: "2026-02-01T00:00:00Z",
    });

    expect(composite).not.toBeNull();
    expect(composite?.riskBand).toBe("high");
    expect(composite?.reasonCodes).toContain("no_submissions");
    expect(composite?.reasonCodes).toContain("no_engagement_events");
    expect(composite?.componentScores.academic).toBeGreaterThan(0);
  });

  it("keeps a strong student in the low band when engagement and submission patterns are healthy", () => {
    const academic = evaluateStudentRisk(trajectory([84, 86, 88, 90]));
    const composite = evaluateCompositeStudentRisk({
      academicEvaluation: academic,
      engagement: { eventCount: 12, lastEventAt: "2026-01-31T12:00:00Z" },
      submissions: { totalAssignments: 5, submittedAssignments: 5, lateSubmissions: 0 },
      referenceDate: "2026-02-01T00:00:00Z",
    });

    expect(composite).not.toBeNull();
    expect(composite?.riskBand).toBe("low");
    expect(composite?.reasonCodes).toContain("strong_submission_coverage");
    expect(composite?.reasonCodes).toContain("active_engagement");
    expect(composite?.rawRiskScore).toBeLessThan(45);
  });
});
