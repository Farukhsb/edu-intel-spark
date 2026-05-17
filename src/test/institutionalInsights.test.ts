import { describe, expect, it } from "vitest";

import {
  buildInstitutionalInsightsSnapshot,
  EMPTY_ACCREDITATION,
  getInstitutionalReportingReadiness,
  getMetricStatus,
} from "@/lib/institutionalInsights";

describe("institutionalInsights", () => {
  it("builds institutional metrics from live-grade style inputs", () => {
    const snapshot = buildInstitutionalInsightsSnapshot({
      assignments: [
        { id: "a1", title: "Incident Report", module_code: "CS401" },
        { id: "a2", title: "Schema Reflection", module_code: "CS402" },
      ],
      submissions: [
        { id: "s1", assignment_id: "a1" },
        { id: "s2", assignment_id: "a1" },
        { id: "s3", assignment_id: "a2" },
      ],
      grades: [
        { submission_id: "s1", final_score: 35, ai_score: null },
        { submission_id: "s2", final_score: 55, ai_score: null },
        { submission_id: "s3", final_score: null, ai_score: 72 },
      ],
      profiles: [
        { id: "student-1", role: "student" },
        { id: "student-2", role: "student" },
      ],
    });

    expect(snapshot.hasRealData).toBe(true);
    expect(snapshot.lowPerforming).toEqual([
      {
        id: "a1",
        name: "Incident Report",
        avgGrade: 45,
        passRate: 50,
        students: 2,
        issue: "Low average - review needed",
      },
      {
        id: "a2",
        name: "Schema Reflection",
        avgGrade: 72,
        passRate: 100,
        students: 1,
        issue: "Moderate performance",
      },
    ]);

    expect(snapshot.moduleStats).toEqual([
      {
        module: "CS402",
        students: 1,
        avgGrade: 72,
        passRate: 100,
      },
      {
        module: "CS401",
        students: 2,
        avgGrade: 45,
        passRate: 50,
      },
    ]);

    expect(snapshot.accreditation).toEqual([
      { metric: "Module Pass Rate (Avg)", value: 67, target: 75, status: "at-risk" },
      { metric: "Graded Submissions", value: 100, target: 95, status: "met" },
      { metric: "Average Score", value: 54, target: 60, status: "at-risk" },
      { metric: "Assessment Completion Rate", value: 75, target: 90, status: "below" },
    ]);
  });

  it("returns empty-state metrics when no real assessment activity exists", () => {
    const snapshot = buildInstitutionalInsightsSnapshot({
      assignments: [],
      submissions: [],
      grades: [],
      profiles: [],
    });

    expect(snapshot.hasRealData).toBe(false);
    expect(snapshot.lowPerforming).toEqual([]);
    expect(snapshot.moduleStats).toEqual([]);
    expect(snapshot.accreditation).toEqual(EMPTY_ACCREDITATION);
  });

  it("classifies metric status against targets consistently", () => {
    expect(getMetricStatus(75, 75)).toBe("met");
    expect(getMetricStatus(68, 75)).toBe("at-risk");
    expect(getMetricStatus(50, 75)).toBe("below");
  });

  it("derives a concise reporting-readiness summary from institutional signals", () => {
    expect(
      getInstitutionalReportingReadiness({
        accreditation: [
          { metric: "Module Pass Rate (Avg)", value: 67, target: 75, status: "at-risk" },
          { metric: "Graded Submissions", value: 100, target: 95, status: "met" },
        ],
        lowPerforming: [
          {
            id: "a1",
            name: "Incident Report",
            avgGrade: 45,
            passRate: 50,
            students: 2,
            issue: "Low average - review needed",
          },
        ],
      }),
    ).toEqual({
      posture: "watch",
      postureLabel: "Watch list position",
      likelyChallenge: "Module Pass Rate (Avg)",
      bestNextReport: "Accreditation compliance review",
    });
  });
});
