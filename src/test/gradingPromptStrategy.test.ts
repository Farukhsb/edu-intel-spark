import { describe, expect, it } from "vitest";

import {
  buildAssignmentTypeStrategy,
  buildGradingPrompt,
  buildRubricCalibrationGuide,
  buildSystemPrompt,
} from "../../supabase/functions/grade-submission/prompting";

describe("grading prompt strategy", () => {
  it("adds assignment-type-specific guidance for code grading", () => {
    const strategy = buildAssignmentTypeStrategy("Code");
    expect(strategy).toContain("ASSIGNMENT-TYPE STRATEGY: CODE");
    expect(strategy).toContain("functional correctness");
    expect(strategy).toContain("Do not over-reward comments, formatting, or fluent explanation");
  });

  it("adds assignment-type-specific guidance for reflective grading", () => {
    const strategy = buildAssignmentTypeStrategy("Reflective");
    expect(strategy).toContain("ASSIGNMENT-TYPE STRATEGY: REFLECTIVE");
    expect(strategy).toContain("specificity, authenticity, self-awareness");
    expect(strategy).toContain("Do not confuse emotional tone or fluent style with depth of reflection.");
  });

  it("injects criterion-specific evidence instructions into the grading prompt", () => {
    const prompt = buildGradingPrompt({
      assignmentType: "Report",
      assignmentTitle: "Systems report",
      assignmentDescription: "Evaluate options with evidence",
      moduleCode: "CS330",
      maximumScore: 100,
      rubricText: "- Evidence (50): Use benchmark evidence\n- Recommendation (50): Justify recommendation",
      rubricCalibrationGuide: "Calibration guide",
      regradeAnchorText: "",
      textPreview: "Global packet",
      criterionEvidenceText: "Criterion 1: Evidence\nFocused excerpt 1...\n\n---\n\nCriterion 2: Recommendation\nFocused excerpt 1...",
    });

    expect(prompt).toContain("ASSIGNMENT-TYPE STRATEGY: REPORT");
    expect(prompt).toContain("Criterion-specific evidence packets:");
    expect(prompt).toContain("Use the criterion-specific packets as your primary evidence map");
  });

  it("calibrates concise upper-band answers as potentially high quality work", () => {
    const guide = buildRubricCalibrationGuide(
      [
        {
          criterion: "Keys and integrity constraints",
          weight: 20,
          description: "Defines primary keys, foreign keys, and relationship integrity clearly.",
        },
        {
          criterion: "Justification and trade-offs",
          weight: 20,
          description: "Explains design choices, limitations, and practical implementation trade-offs.",
        },
      ],
      80,
    );

    const systemPrompt = buildSystemPrompt("Problem Solving", 4, 80);

    expect(guide).toContain("Concise but correct answers can still deserve high marks");
    expect(guide).toContain("70+ does not require long prose");
    expect(guide).toContain("award high marks when the submission states the correct relationships or rationale clearly");
    expect(guide).toContain("DATABASE NORMALISATION EXEMPLARS:");
    expect(guide).toContain("student_id determines student_name and programme_id");
    expect(guide).toContain("Delivery stays separate from Module because staffing changes by run");
    expect(systemPrompt).toContain("A concise answer can still be Good or Excellent if it is correct");
    expect(systemPrompt).toContain("the score should normally sit in the Good band");
    expect(systemPrompt).toContain("the score should not remain in a low mid-band");
  });

  it("keeps maths-specific solver guidance in the system prompt", () => {
    const systemPrompt = buildSystemPrompt("Mathematics", 2, 100);
    expect(systemPrompt).toContain("MATHEMATICS / LOGIC-CHECKER mode");
    expect(systemPrompt).toContain("Distinguish arithmetic slips from conceptual flaws.");
    expect(systemPrompt).toContain("solver-like behaviour");
  });
});
