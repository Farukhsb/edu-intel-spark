import { deriveAccreditationMetrics, deriveProgrammeReports } from "@/lib/accreditationMetrics";

describe("accreditation metric derivation", () => {
  it("derives dashboard metrics from live assessment data", () => {
    const derived = deriveAccreditationMetrics({
      assignments: [
        {
          id: "a1",
          title: "Algorithms",
          module_code: "CS401",
          due_date: "2026-04-01",
          description: "Essay",
          rubric: [{ criterion: "Analysis", weight: 100 }],
        },
        {
          id: "a2",
          title: "Databases",
          module_code: "CS402",
          due_date: null,
          description: null,
          rubric: [],
        },
      ],
      submissions: [
        { id: "s1", assignment_id: "a1", submitted_at: "2026-04-01T00:00:00.000Z", status: "released" },
        { id: "s2", assignment_id: "a2", submitted_at: "2026-04-02T00:00:00.000Z", status: "approved" },
      ],
      grades: [
        {
          submission_id: "s1",
          ai_score: 65,
          final_score: 68,
          ai_feedback:
            "Detailed and actionable feedback that is definitely longer than one hundred characters so the helpfulness signal is triggered in the derived metric set.",
          lecturer_score: 68,
          reviewed_by: "lecturer-1",
          created_at: "2026-04-10T00:00:00.000Z",
        },
        {
          submission_id: "s2",
          ai_score: 38,
          final_score: 42,
          ai_feedback: "Short feedback",
          lecturer_score: null,
          reviewed_by: null,
          created_at: "2026-04-20T00:00:00.000Z",
        },
      ],
      profiles: [
        { id: "lecturer-1", role: "lecturer" },
        { id: "student-1", role: "student" },
        { id: "student-2", role: "student" },
      ],
    });

    expect(derived.feedbackTurnaround).toEqual({
      avg: 14,
      target: 15,
      compliant: 1,
      total: 2,
    });
    expect(derived.qaaMetrics.find((metric) => metric.id === "criteria-transparency")?.value).toBe(50);
    expect(derived.qaaMetrics.find((metric) => metric.id === "grade-release")?.value).toBe(50);
    expect(derived.metCount + derived.atRiskCount + derived.belowCount).toBe(derived.qaaMetrics.length);
    expect(derived.nssMetrics).toHaveLength(6);
    expect(derived.tefIndicators).toHaveLength(4);
    expect(derived.weakestQaaMetric?.metric).toBeTruthy();
    expect(derived.weakestTefIndicator?.name).toBeTruthy();
  });

  it("derives programme reports by module code", () => {
    const reports = deriveProgrammeReports({
      assignments: [
        { id: "a1", title: "Algorithms", module_code: "CS401" },
        { id: "a2", title: "Databases", module_code: "CS402" },
      ],
      submissions: [
        { id: "s1", assignment_id: "a1" },
        { id: "s2", assignment_id: "a1" },
        { id: "s3", assignment_id: "a2" },
      ],
      grades: [
        { submission_id: "s1", ai_score: 72, final_score: 72 },
        { submission_id: "s2", ai_score: 55, final_score: 55 },
        { submission_id: "s3", ai_score: 38, final_score: 38 },
      ],
    });

    expect(reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "CS401",
          submissions: 2,
          graded: 2,
          avg: 64,
          passRate: 100,
          firstClass: 50,
          twoOne: 0,
          twoTwo: 50,
          third: 0,
          fail: 0,
        }),
        expect.objectContaining({
          code: "CS402",
          submissions: 1,
          graded: 1,
          avg: 38,
          passRate: 0,
          fail: 100,
        }),
      ])
    );
  });
});
