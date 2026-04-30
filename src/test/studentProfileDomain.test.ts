import { describe, expect, it, vi } from "vitest";

import { buildStudentInsightData, matchStudentSubmissions } from "@/lib/studentProfile";

describe("studentProfile domain", () => {
  it("matches student submissions by slugged name, email, or id", () => {
    const submissions = [
      {
        id: "s1",
        assignment_id: "a1",
        student_id: null,
        student_name: "Sam Student",
        student_email: "sam@example.edu",
        status: "released",
        submitted_at: "2026-04-10T10:00:00.000Z",
      },
    ];

    expect(matchStudentSubmissions({ submissions, studentId: "sam-student" })).toHaveLength(1);
    expect(matchStudentSubmissions({ submissions, studentId: "sam@example.edu" })).toHaveLength(1);
  });

  it("builds a student insight projection with risk reasons and missed work", () => {
    const computeRisk = vi.fn(() => ({
      riskScore: 76,
      riskLevel: "critical" as const,
      flags: ["Average below 50%"],
      recommendation: "Schedule a support meeting.",
    }));

    const profile = buildStudentInsightData({
      assignments: [
        { id: "a1", title: "Essay 1", module_code: "CS301", due_date: null, max_score: 100 },
        { id: "a2", title: "Lab Reflection", module_code: "CS205", due_date: null, max_score: 100 },
      ],
      submissions: [
        {
          id: "s1",
          assignment_id: "a1",
          student_id: "student-1",
          student_name: "Sam Student",
          student_email: "sam@example.edu",
          status: "released",
          submitted_at: "2026-04-10T10:00:00.000Z",
        },
      ],
      grades: [{ submission_id: "s1", final_score: 42, ai_score: null }],
      decodedStudentId: "sam-student",
      studentRecordId: "student-1",
      computeRisk,
    });

    expect(profile?.name).toBe("Sam Student");
    expect(profile?.averageGrade).toBe(42);
    expect(profile?.riskLevel).toBe("critical");
    expect(profile?.reasons).toContain("Average below 50%");
    expect(profile?.reasons).toContain("1 assignment missing");
    expect(profile?.missedAssignments).toHaveLength(1);
    expect(profile?.chart).toHaveLength(1);
  });
});
