import { describe, expect, it, vi } from "vitest";

import {
  buildGradeDistribution,
  buildPerformanceProjection,
  EMPTY_GRADE_DIST,
  filterAtRiskStudents,
  getPerformanceReportingReadiness,
} from "@/lib/performanceAnalytics";
import type { AtRiskStudent } from "@/lib/studentRisk";

describe("performanceAnalytics", () => {
  it("builds cohort projections from assignment, submission, and grade data", () => {
    const computeRisk = vi.fn((trajectory) => ({
      name: trajectory.name,
      email: trajectory.email,
      studentId: trajectory.studentId,
      avgGrade: 38,
      lastGrade: 32,
      predictedNext: 30,
      trend: "declining" as const,
      riskScore: 76,
      riskLevel: "critical" as const,
      flags: ["Average below 40%"],
      recommendation: "Intervene now",
      sparkline: trajectory.scores.map((entry: { score: number }) => entry.score),
    }));

    const projection = buildPerformanceProjection({
      assignments: [
        { id: "a1", title: "Algorithms Coursework", module_code: "CS101" },
        { id: "a2", title: "Data Reflection", module_code: "CS101" },
      ],
      submissions: [
        {
          id: "s1",
          assignment_id: "a1",
          student_id: "student-1",
          student_name: "Sam Student",
          student_email: "sam@example.edu",
          submitted_at: "2026-04-10T10:00:00.000Z",
        },
        {
          id: "s2",
          assignment_id: "a2",
          student_id: "student-1",
          student_name: "Sam Student",
          student_email: "sam@example.edu",
          submitted_at: "2026-04-20T10:00:00.000Z",
        },
      ],
      grades: [
        { submission_id: "s1", final_score: 42, ai_score: null },
        { submission_id: "s2", final_score: 32, ai_score: null },
      ],
      moduleFilter: "all",
      computeRisk,
    });

    expect(projection.modules).toEqual(["CS101"]);
    expect(projection.assessmentTrends).toHaveLength(2);
    expect(projection.gradeDist.find((entry) => entry.band === "Fail (<40%)")?.count).toBe(1);
    expect(projection.gradeDist.find((entry) => entry.band === "3rd (40-49%)")?.count).toBe(1);
    expect(projection.atRiskStudents).toHaveLength(1);
    expect(computeRisk).toHaveBeenCalledTimes(1);
  });

  it("filters at-risk students by risk and score bands", () => {
    const students: AtRiskStudent[] = [
      {
        name: "Student One",
        email: "one@example.edu",
        studentId: "1",
        riskScore: 90,
        riskLevel: "critical" as const,
        avgGrade: 35,
        lastGrade: 30,
        trend: "declining" as const,
        flags: ["Average below 40%"],
        sparkline: [40, 35, 30],
        recommendation: "Intervene now",
        predictedNext: 28,
      },
      {
        name: "Student Two",
        email: "two@example.edu",
        studentId: "2",
        riskScore: 60,
        riskLevel: "high" as const,
        avgGrade: 45,
        lastGrade: 44,
        trend: "stable-low" as const,
        flags: ["Average below 50%"],
        sparkline: [48, 45, 44],
        recommendation: "Monitor closely",
        predictedNext: 42,
      },
      {
        name: "Student Three",
        email: "three@example.edu",
        studentId: "3",
        riskScore: 40,
        riskLevel: "moderate" as const,
        avgGrade: 62,
        lastGrade: 60,
        trend: "volatile" as const,
        flags: [],
        sparkline: [61, 62, 60],
        recommendation: "Continue monitoring",
        predictedNext: 61,
      },
    ];

    expect(filterAtRiskStudents({ students: [...students], riskFilter: "high-plus", scoreBandFilter: "lt40" })).toHaveLength(1);
    expect(filterAtRiskStudents({ students: [...students], riskFilter: "all", scoreBandFilter: "40-49" })).toHaveLength(1);
  });

  it("returns an empty grade distribution shape for no scores", () => {
    expect(buildGradeDistribution([])).toEqual(EMPTY_GRADE_DIST);
  });

  it("derives a reporting-readiness summary from risk, failing-band, and assessment signals", () => {
    const readiness = getPerformanceReportingReadiness({
      assessmentTrends: [
        { name: "Normalisation Case Study", avgGrade: 52, participation: 86 },
        { name: "Schema Redesign Memo", avgGrade: 61, participation: 90 },
      ],
      atRiskStudents: [
        {
          studentId: "risk-1",
          name: "Mariam Okeke",
          email: "mariam@example.edu",
          avgGrade: 37,
          lastGrade: 26,
          predictedNext: 24,
          trend: "declining",
          riskScore: 88,
          riskLevel: "critical",
          flags: ["Average below 40%"],
          recommendation: "Immediate support",
          sparkline: [49, 37, 26],
        },
      ],
      gradeDist: buildGradeDistribution([72, 66, 52, 39, 34]),
    });

    expect(readiness.postureLabel).toBe("Immediate intervention position");
    expect(readiness.likelyChallenge).toBe("Normalisation Case Study");
    expect(readiness.bestNextAction).toBe("Open early support signals and act on high-risk students");
  });
});
