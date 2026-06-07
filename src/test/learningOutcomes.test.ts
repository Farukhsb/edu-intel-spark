import { describe, expect, it, vi } from "vitest";

import {
  buildLearningOutcomesSnapshot,
  loadLearningOutcomesData,
  getLearningOutcomesReportingReadiness,
} from "@/lib/learningOutcomes";

describe("learningOutcomes", () => {
  const makeSupabaseQuery = (result: { data: unknown; error: unknown }) => {
    const query: Record<string, unknown> = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      in: vi.fn(() => query),
      then: (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve),
    };

    return query;
  };

  it("builds criterion outcomes and chronologically ordered trajectories", () => {
    const snapshot = buildLearningOutcomesSnapshot({
      submissions: [
        {
          id: "s-late",
          assignment_id: "a1",
          student_id: "student-1",
          student_name: "Sam Student",
          student_email: "sam@example.edu",
          submitted_at: "2026-04-20T10:00:00.000Z",
        },
        {
          id: "s-early",
          assignment_id: "a1",
          student_id: "student-1",
          student_name: "Sam Student",
          student_email: "sam@example.edu",
          submitted_at: "2026-04-10T10:00:00.000Z",
        },
        {
          id: "s-other",
          assignment_id: "a2",
          student_id: "student-2",
          student_name: "Ada Learner",
          student_email: "ada@example.edu",
          submitted_at: "2026-04-18T10:00:00.000Z",
        },
      ],
      grades: [
        {
          submission_id: "s-late",
          final_score: 45,
          ai_score: null,
          ai_breakdown: [{ criterion: "Analysis", score: 9, max_score: 20 }],
        },
        {
          submission_id: "s-early",
          final_score: 62,
          ai_score: null,
          ai_breakdown: [{ criterion: "Analysis", score: 15, max_score: 20 }],
        },
        {
          submission_id: "s-other",
          final_score: 72,
          ai_score: null,
          ai_breakdown: [{ criterion: "Communication", score: 14, max_score: 20 }],
        },
      ],
      selectedAssignment: "all",
    });

    expect(snapshot.outcomes).toEqual([
      {
        criterion: "Analysis",
        avgScore: 12,
        maxScore: 20,
        pct: 60,
        status: "approaching",
      },
      {
        criterion: "Communication",
        avgScore: 14,
        maxScore: 20,
        pct: 70,
        status: "above",
      },
    ]);

    expect(snapshot.trajectories).toEqual([
      {
        name: "Sam Student",
        scores: [62, 45],
        trend: "declining",
      },
    ]);
  });

  it("builds improving and stable trajectories while ignoring malformed scores", () => {
    const snapshot = buildLearningOutcomesSnapshot({
      submissions: [
        {
          id: "s-1",
          assignment_id: "a1",
          student_id: "student-1",
          student_name: "Taylor Learner",
          student_email: "taylor@example.edu",
          submitted_at: "2026-04-10T10:00:00.000Z",
        },
        {
          id: "s-2",
          assignment_id: "a1",
          student_id: "student-1",
          student_name: "Taylor Learner",
          student_email: "taylor@example.edu",
          submitted_at: "2026-04-20T10:00:00.000Z",
        },
        {
          id: "s-3",
          assignment_id: "a1",
          student_id: "student-1",
          student_name: "Taylor Learner",
          student_email: "taylor@example.edu",
          submitted_at: "2026-05-01T10:00:00.000Z",
        },
        {
          id: "s-4",
          assignment_id: "a2",
          student_id: "student-2",
          student_name: "Jordan Learner",
          student_email: "jordan@example.edu",
          submitted_at: "2026-04-12T10:00:00.000Z",
        },
      ],
      grades: [
        {
          submission_id: "s-1",
          final_score: null,
          ai_score: 42,
          ai_breakdown: [
            null,
            { name: "Analysis", score: 7, maxScore: 14 },
            { criterion: 42, score: "bad" },
          ],
        },
        {
          submission_id: "s-2",
          final_score: 48,
          ai_score: null,
          ai_breakdown: [{ criterion: "Communication", score: 6, max_score: 10 }],
        },
        {
          submission_id: "s-3",
          final_score: 60,
          ai_score: null,
          ai_breakdown: "not-an-array",
        },
        {
          submission_id: "s-4",
          final_score: NaN,
          ai_score: null,
          ai_breakdown: [{ criterion: "Ignored", score: 4, max_score: 10 }],
        },
      ],
      selectedAssignment: "all",
    });

    expect(snapshot.outcomes).toEqual(
      expect.arrayContaining([
        {
          criterion: "Analysis",
          avgScore: 7,
          maxScore: 14,
          pct: 50,
          status: "approaching",
        },
        {
          criterion: "Communication",
          avgScore: 6,
          maxScore: 10,
          pct: 60,
          status: "approaching",
        },
        {
          criterion: "Ignored",
          avgScore: 4,
          maxScore: 10,
          pct: 40,
          status: "below",
        },
        {
          criterion: "Unknown",
          avgScore: 0,
          maxScore: 10,
          pct: 0,
          status: "below",
        },
      ]),
    );
    expect(snapshot.outcomes).toHaveLength(4);
    expect(snapshot.trajectories).toEqual([
      {
        name: "Taylor Learner",
        scores: [42, 48, 60],
        trend: "improving",
      },
    ]);
  });

  it("filters to the selected assignment and ignores single-score students", () => {
    const snapshot = buildLearningOutcomesSnapshot({
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
        {
          submission_id: "s1",
          final_score: 51,
          ai_score: null,
          ai_breakdown: [{ criterion: "Analysis", score: 10, max_score: 20 }],
        },
        {
          submission_id: "s2",
          final_score: 67,
          ai_score: null,
          ai_breakdown: [{ criterion: "Communication", score: 16, max_score: 20 }],
        },
      ],
      selectedAssignment: "a2",
    });

    expect(snapshot.outcomes).toEqual([
      {
        criterion: "Communication",
        avgScore: 16,
        maxScore: 20,
        pct: 80,
        status: "above",
      },
    ]);
    expect(snapshot.trajectories).toEqual([]);
  });

  it("loads data from Supabase and returns empty snapshots when the upstream tables are empty", async () => {
    const responses: Record<string, { data: unknown; error: unknown }> = {
      assignments: { data: [], error: null },
      submissions: { data: [], error: null },
      grades: { data: [], error: null },
    };
    const supabase = {
      from: vi.fn((table: string) => {
        const query = makeSupabaseQuery(responses[table]);
        return query;
      }),
    } as never;

    const snapshot = await loadLearningOutcomesData({
      supabase,
      lecturerId: "lecturer-1",
      selectedAssignment: "all",
    });

    expect(snapshot).toEqual({
      assignments: [],
      outcomes: [],
      trajectories: [],
    });
  });

  it("surfaces load errors from the assignments and grades queries", async () => {
    const assignmentsSupabase = {
      from: vi.fn(() => makeSupabaseQuery({ data: null, error: new Error("assignments unavailable") })),
    } as never;

    await expect(
      loadLearningOutcomesData({
        supabase: assignmentsSupabase,
        lecturerId: "lecturer-1",
        selectedAssignment: "all",
      }),
    ).rejects.toThrow("assignments unavailable");

    const gradesSupabase = {
      from: vi.fn((table: string) => {
        if (table === "assignments") {
          return makeSupabaseQuery({
            data: [{ id: "assignment-1", title: "Essay", module_code: "ENG101" }],
            error: null,
          });
        }
        if (table === "submissions") {
          return makeSupabaseQuery({
            data: [
              {
                id: "submission-1",
                assignment_id: "assignment-1",
                student_id: "student-1",
                student_name: "Sam Student",
                student_email: "sam@example.edu",
                submitted_at: "2026-04-10T10:00:00.000Z",
              },
            ],
            error: null,
          });
        }
        return makeSupabaseQuery({ data: null, error: new Error("grades unavailable") });
      }),
    } as never;

    await expect(
      loadLearningOutcomesData({
        supabase: gradesSupabase,
        lecturerId: "lecturer-1",
        selectedAssignment: "all",
      }),
    ).rejects.toThrow("grades unavailable");
  });

  it("derives a concise reporting-readiness summary from outcomes and trajectories", () => {
    expect(
      getLearningOutcomesReportingReadiness({
        outcomes: [
          {
            criterion: "Analysis",
            avgScore: 12,
            maxScore: 20,
            pct: 60,
            status: "approaching",
          },
        ],
        trajectories: [
          {
            name: "Sam Student",
            scores: [62, 45],
            trend: "declining",
          },
        ],
      }),
    ).toEqual({
      postureLabel: "Watch list position",
      likelyChallenge: "Analysis",
      bestNextAction: "Review declining student trajectories",
    });
  });
});
