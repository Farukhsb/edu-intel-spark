import { describe, expect, it } from "vitest";

import {
  buildPlanModules,
  buildResourceRecommendations,
  getOverallTaskSummary,
} from "@/lib/improvementPlan";

describe("improvement plan domain helpers", () => {
  it("builds module plans from submissions, grades, and assignment metadata", () => {
    const plan = buildPlanModules({
      submissions: [
        {
          id: "submission-1",
          assignment_id: "assignment-1",
          submitted_at: "2026-04-20T10:00:00.000Z",
        },
      ],
      grades: [
        {
          submission_id: "submission-1",
          final_score: 68,
          ai_score: 68,
          ai_breakdown: [
            {
              criterion: "Analysis",
              score: 6,
              max_score: 10,
              feedback:
                "Your discussion of AI in assessment describes concepts but does not clearly evaluate their impact.",
            },
            {
              criterion: "Testing",
              score: 5,
              max_score: 10,
              feedback: "No visible test evidence.",
            },
          ],
        },
      ],
      assignmentMap: {
        "assignment-1": {
          id: "assignment-1",
          title: "Algorithms Coursework",
          module_code: "CS101",
          max_score: 100,
        },
      },
      taskOverrides: {},
    });

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      module: "CS101 - Algorithms Coursework",
      currentGrade: 68,
      targetGrade: 76,
      weaknesses: ["Testing", "Analysis"],
    });
    expect(plan[0].weakCriteria[0]).toMatchObject({
      criterion: "Testing",
      average: 50,
      feedback: "No visible test evidence.",
    });
  });

  it("turns weak criteria into prioritized best-next-move cards and task summary", () => {
    const plan = buildPlanModules({
      submissions: [
        {
          id: "submission-1",
          assignment_id: "assignment-1",
          submitted_at: "2026-04-20T10:00:00.000Z",
        },
      ],
      grades: [
        {
          submission_id: "submission-1",
          final_score: 68,
          ai_score: 68,
          ai_breakdown: [
            {
              criterion: "Analysis",
              score: 6,
              max_score: 10,
              feedback:
                "Your discussion of AI in assessment describes concepts but does not clearly evaluate their impact.",
            },
            {
              criterion: "Testing",
              score: 5,
              max_score: 10,
              feedback: "No visible test evidence.",
            },
          ],
        },
      ],
      assignmentMap: {
        "assignment-1": {
          id: "assignment-1",
          title: "Algorithms Coursework",
          module_code: "CS101",
          max_score: 100,
        },
      },
      taskOverrides: {
        "cs101---algorithms-coursework-testing-0": true,
      },
    });

    const resources = buildResourceRecommendations(plan);
    const summary = getOverallTaskSummary(plan);

    expect(resources[0]).toMatchObject({
      heading: "CS101: Testing",
      estimatedLift: "Strong recovery opportunity",
      priorityLabel: "High impact",
      evidenceBasis: "Based on direct criterion feedback from graded work.",
      duration: "15 min review",
      issue: "No visible test evidence.",
    });
    expect(resources[0].actionItems[0]).toMatch(/operation outputs|screenshots/i);
    expect(summary).toEqual({
      total: 2,
      completed: 1,
      progress: 50,
    });
  });

  it("uses broader wording when recommendation evidence is limited", () => {
    const resources = buildResourceRecommendations([
      {
        module: "CS101 - Algorithms Coursework",
        currentGrade: 62,
        targetGrade: 70,
        trend: "steady",
        trendDelta: 0,
        strengths: [],
        weaknesses: ["Criterion 1"],
        nextSubmissionFocus: [],
        tasks: [],
        chart: [],
        weakCriteria: [
          {
            criterion: "Criterion 1",
            average: 64,
            attempts: 1,
          },
        ],
      },
    ]);

    expect(resources[0]).toMatchObject({
      heading: "CS101: Rubric Criterion 1",
      estimatedLift: "Good recovery opportunity",
      evidenceStrength: "limited",
      evidenceBasis: "Based on limited evidence from current graded work, so this guidance is intentionally broad.",
      duration: "short review",
    });
  });
});
