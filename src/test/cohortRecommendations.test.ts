import { describe, expect, it } from "vitest";

import {
  buildCohortRecommendations,
  getCohortReportingReadiness,
  type AssignmentAnalytics,
  type CohortAnalyticsSnapshot,
  type CohortRecommendation,
} from "@/lib/cohortRecommendations";
import type { AtRiskStudent } from "@/lib/studentRisk";

describe("cohortRecommendations", () => {
  const buildAtRiskStudent = (studentId: string, riskLevel: AtRiskStudent["riskLevel"]): AtRiskStudent => ({
    name: `Student ${studentId}`,
    email: `${studentId}@example.edu`,
    studentId,
    riskScore: riskLevel === "critical" ? 92 : 76,
    riskLevel,
    avgGrade: 34,
    lastGrade: 28,
    trend: "declining",
    reasonCodes: ["average_below_40"],
    flags: ["Average below 40%"],
    sparkline: [42, 35, 28],
    recommendation: "Schedule a support check-in.",
    predictedNext: 26,
  });

  it("builds and sorts all key cohort recommendations from a rich snapshot", () => {
    const snapshot: CohortAnalyticsSnapshot = {
      lecturerId: "lecturer-1",
      cohortAverage: 82,
      failRate: 4,
      gradedCount: 60,
      assignments: [
        {
          id: "assignment-low",
          title: "Low Cohort Average",
          moduleCode: "CS101",
          avgScore: 30,
          failRate: 35,
          passRate: 65,
          gradedCount: 20,
          submissions: 20,
          createdAt: "2026-04-01T09:00:00.000Z",
        },
        {
          id: "assignment-fail",
          title: "High Failure Rate",
          moduleCode: "CS101",
          avgScore: 55,
          failRate: 60,
          passRate: 40,
          gradedCount: 20,
          submissions: 20,
          createdAt: "2026-04-05T09:00:00.000Z",
        },
        {
          id: "assignment-previous",
          title: "Earlier Assignment",
          moduleCode: "CS101",
          avgScore: 75,
          failRate: 10,
          passRate: 90,
          gradedCount: 20,
          submissions: 20,
          createdAt: "2026-04-10T09:00:00.000Z",
        },
        {
          id: "assignment-current",
          title: "Later Assignment",
          moduleCode: "CS101",
          avgScore: 50,
          failRate: 12,
          passRate: 88,
          gradedCount: 20,
          submissions: 20,
          createdAt: "2026-04-20T09:00:00.000Z",
        },
        {
          id: "assignment-rubric",
          title: "Weak Rubric Area",
          moduleCode: "CS101",
          avgScore: 68,
          failRate: 8,
          passRate: 92,
          gradedCount: 20,
          submissions: 20,
          createdAt: "2026-04-25T09:00:00.000Z",
        },
      ],
      criteria: [
        {
          key: "criteria-analysis",
          criterion: "Analysis",
          avgScore: 7.8,
          averagePercent: 39,
          submissionCount: 20,
          assignmentId: "assignment-rubric",
          assignmentTitle: "Weak Rubric Area",
        },
        {
          key: "criteria-design",
          criterion: "Design",
          avgScore: 8.8,
          averagePercent: 54,
          submissionCount: 20,
          assignmentId: "assignment-rubric",
          assignmentTitle: "Weak Rubric Area",
        },
      ],
      atRiskStudents: [
        buildAtRiskStudent("student-1", "critical"),
        buildAtRiskStudent("student-2", "critical"),
        buildAtRiskStudent("student-3", "critical"),
        buildAtRiskStudent("student-4", "critical"),
        buildAtRiskStudent("student-5", "critical"),
        buildAtRiskStudent("student-6", "critical"),
        buildAtRiskStudent("student-7", "critical"),
        buildAtRiskStudent("student-8", "critical"),
        buildAtRiskStudent("student-9", "high"),
        buildAtRiskStudent("student-10", "high"),
        buildAtRiskStudent("student-11", "high"),
        buildAtRiskStudent("student-12", "high"),
      ],
      highRiskStudents: [
        buildAtRiskStudent("student-1", "critical"),
        buildAtRiskStudent("student-2", "critical"),
        buildAtRiskStudent("student-3", "critical"),
        buildAtRiskStudent("student-4", "critical"),
        buildAtRiskStudent("student-5", "critical"),
        buildAtRiskStudent("student-6", "critical"),
        buildAtRiskStudent("student-7", "critical"),
        buildAtRiskStudent("student-8", "critical"),
        buildAtRiskStudent("student-9", "high"),
        buildAtRiskStudent("student-10", "high"),
        buildAtRiskStudent("student-11", "high"),
        buildAtRiskStudent("student-12", "high"),
      ],
      integrityFlaggedCount: 8,
      integritySubmissionCount: 20,
      integrityFlaggedSubmissionIds: ["sub-1", "sub-2", "sub-3", "sub-4", "sub-5", "sub-6", "sub-7", "sub-8"],
      integrityByAssignment: [
        {
          assignmentId: "assignment-rubric",
          assignmentTitle: "Weak Rubric Area",
          flaggedCount: 8,
          submissionCount: 20,
          flaggedSubmissionIds: ["sub-1", "sub-2", "sub-3", "sub-4", "sub-5", "sub-6", "sub-7", "sub-8"],
        },
      ],
    };

    const recommendations = buildCohortRecommendations(snapshot);

    expect(recommendations.map((recommendation) => recommendation.ruleCode)).toEqual([
      "high_failure_rate",
      "high_risk_student_cluster",
      "integrity_spike",
      "low_cohort_average",
      "assignment_score_drop",
      "weak_rubric_criterion",
      "positive_cohort_signal",
    ]);
    expect(recommendations[0].severity).toBe("critical");
    expect(recommendations[3].summary).toContain("below the 45% threshold");
    expect(recommendations[4].summary).toContain("below Earlier Assignment");
    expect(recommendations[5].evidence.criterion).toBe("Analysis");
    expect(recommendations[6].type).toBe("positive signals");
  });

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

  it("falls back to the weakest assignment when no recommendations are present", () => {
    const readiness = getCohortReportingReadiness({
      assignments: [
        {
          id: "assignment-1",
          title: "Statistics Lab",
          moduleCode: "CS205",
          avgScore: 61,
          failRate: 14,
          passRate: 86,
          gradedCount: 24,
          submissions: 24,
          createdAt: "2026-04-21T09:00:00.000Z",
        },
      ],
      recommendations: [],
    });

    expect(readiness).toEqual({
      postureLabel: "Stable oversight position",
      likelyChallenge: "Statistics Lab",
      bestNextAction: "Review the weakest assignment before the next release cycle",
    });
  });
});
