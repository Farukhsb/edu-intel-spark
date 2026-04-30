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
                "Your discussion of AI fairness risk describes concepts but does not clearly evaluate their impact.",
            },
            {
              criterion: "Testing",
              score: 5,
              max_score: 10,
              feedback: "BST deletion and traversal logic are not demonstrated with test output.",
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
      guidanceMode: "future",
      weaknesses: ["Testing", "Analysis"],
    });
    expect(plan[0].weakCriteria[0]).toMatchObject({
      criterion: "Testing",
      average: 50,
      feedback: "BST deletion and traversal logic are not demonstrated with test output.",
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
                "Your discussion of AI fairness risk describes concepts but does not clearly evaluate their impact.",
            },
            {
              criterion: "Testing",
              score: 5,
              max_score: 10,
              feedback: "BST deletion and traversal logic are not demonstrated with test output.",
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
      guidanceMode: "future",
      guidanceLabel: "Future improvement plan",
      priorityLabel: "High impact",
      evidenceBasis: "Based on direct criterion feedback from graded work.",
      duration: "15 min review",
      weakestCriterionSummary: "Weakest criterion: Testing (50% loss)",
      feedbackSignal: "BST deletion and traversal logic are not demonstrated with test output.",
      conceptHint: "BST deletion and traversal logic",
      issue:
        "In your CS101 submission, your bst deletion and traversal logic are not visibly demonstrated, so the marker could not verify it clearly.",
    });
    expect(resources[0].actionItems[0]).toBe(
      "For future assignments, add operation outputs or screenshots that show bst deletion and traversal logic working",
    );
    expect(plan[0].nextSubmissionFocus[0]).toMatch(/Improve testing next time/i);
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
      guidanceMode: "future",
      evidenceStrength: "limited",
      evidenceBasis: "Based on limited evidence from current graded work, so this guidance is intentionally broad.",
      duration: "short review",
    });
  });

  it("switches to recovery guidance for failed work", () => {
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
          final_score: 30,
          ai_score: 30,
          ai_breakdown: [
            {
              criterion: "Analysis",
              score: 3,
              max_score: 10,
              feedback: "Your discussion of AI fairness risk is descriptive and does not clearly evaluate the fairness risks.",
            },
          ],
        },
      ],
      assignmentMap: {
        "assignment-1": {
          id: "assignment-1",
          title: "AI in Assessment Essay",
          module_code: "CS301",
          max_score: 100,
        },
      },
      taskOverrides: {},
    });

    const resources = buildResourceRecommendations(plan);

    expect(plan[0]).toMatchObject({
      currentGrade: 30,
      guidanceMode: "recovery",
    });
    expect(plan[0].nextSubmissionFocus[0]).toMatch(/Recover analysis/i);
    expect(resources[0]).toMatchObject({
      guidanceMode: "recovery",
      guidanceLabel: "Recovery plan",
      weakestCriterionSummary: "Weakest criterion: Analysis (70% loss)",
      feedbackSignal: "Your discussion of AI fairness risk is descriptive and does not clearly evaluate the fairness risks.",
      conceptHint: "AI fairness risk",
    });
    expect(resources[0].issue).toBe(
      "In your CS301 assignment, your ai fairness risk describes concepts but does not evaluate them clearly enough for the marker to see a defended judgement.",
    );
    expect(resources[0].actionItems[0]).toMatch(/For resubmission, rewrite ai fairness risk so it compares at least two viewpoints/i);
    expect(resources[0].evidenceOfImprovement).toMatch(/resubmission meet the rubric minimums/i);
  });
});
