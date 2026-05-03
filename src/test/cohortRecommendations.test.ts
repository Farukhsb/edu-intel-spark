import { describe, expect, it } from "vitest";

import {
  getCohortReportingReadiness,
  type AssignmentAnalytics,
  type CohortRecommendation,
} from "@/lib/cohortRecommendations";

describe("cohortRecommendations", () => {
  it("derives a cohort reporting-readiness summary from recommendation severity and assignment weakness", () => {
    const assignments: AssignmentAnalytics[] = [
      {
        id: "assignment-1",
        title: "Algorithms Coursework",
        moduleCode: "CS205",
        avgScore: 63,
        failRate: 18,
        passRate: 82,
        gradedCount: 28,
        submissions: 30,
        createdAt: "2026-04-21T09:00:00.000Z",
      },
      {
        id: "assignment-2",
        title: "Dynamic Programming Test",
        moduleCode: "CS205",
        avgScore: 49,
        failRate: 37,
        passRate: 63,
        gradedCount: 30,
        submissions: 30,
        createdAt: "2026-04-29T09:00:00.000Z",
      },
    ];

    const recommendations: CohortRecommendation[] = [
      {
        id: "demo:student_risk_cluster",
        type: "student risk",
        ruleCode: "high_risk_student_cluster",
        title: "High-risk student cluster detected",
        summary: "8 students are in the high or critical risk band.",
        explanation: "The trajectory-based risk engine is flagging a meaningful cluster size.",
        severity: "critical",
        confidence: 0.94,
        recommendedActions: ["Open the risk workflow and prioritise the highest-risk students."],
        evidence: {
          metrics: [{ label: "High-risk students", value: "8" }],
          affectedStudentIds: ["student-1"],
          affectedStudentNames: ["Ada Lovelace"],
        },
        status: "open",
        createdAt: "2026-05-03T09:00:00.000Z",
        assignmentId: null,
      },
    ];

    const readiness = getCohortReportingReadiness({
      assignments,
      recommendations,
    });

    expect(readiness.postureLabel).toBe("Immediate intervention position");
    expect(readiness.likelyChallenge).toBe("High-risk student cluster detected");
    expect(readiness.bestNextAction).toBe("Open the risk workflow and prioritise the highest-risk students.");
  });
});
