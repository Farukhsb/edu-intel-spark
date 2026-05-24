import { describe, expect, it } from "vitest";

import {
  buildAssignmentTypeStrategy,
  buildGradingPrompt,
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

  it("keeps maths-specific solver guidance in the system prompt", () => {
    const systemPrompt = buildSystemPrompt("Mathematics", 2, 100);
    expect(systemPrompt).toContain("MATHEMATICS / LOGIC-CHECKER mode");
    expect(systemPrompt).toContain("Distinguish arithmetic slips from conceptual flaws.");
    expect(systemPrompt).toContain("solver-like behaviour");
  });
});
