import { describe, expect, it } from "vitest";

import {
  buildLearningOutcomesSnapshot,
  getLearningOutcomesReportingReadiness,
} from "@/lib/learningOutcomes";

describe("learningOutcomes", () => {
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
