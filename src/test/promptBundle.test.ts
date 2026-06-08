// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildGradingPromptBundle } from "../../supabase/functions/grade-submission/prompt-bundle";

describe("grade-submission prompt bundle", () => {
  it("builds a lean pilot bundle and preserves safe submission messaging", () => {
    const bundle = buildGradingPromptBundle({
      assignment: {
        id: "assignment-1",
        lecturer_id: "lecturer-1",
        title: "Systems Report",
        description: "Analyse trade-offs in a systems design report.",
        module_code: "CS330",
        max_score: 100,
        rubric: [
          { criterion: "Analysis", weight: 50, description: "Analyse the trade-offs." },
          { criterion: "Evidence", weight: 50, description: "Use supporting evidence." },
        ],
      },
      normalizedRubric: [
        { criterion: "Analysis", weight: 50, description: "Analyse the trade-offs." },
        { criterion: "Evidence", weight: 50, description: "Use supporting evidence." },
      ],
      rubricText: "- Analysis (50)\n- Evidence (50)",
      blindedText: "The report compares options and cites evidence.",
      existingGrade: null,
      promptInjectionRisk: { hasRisk: false, signals: [] },
    });

    expect(bundle.systemPrompt).toContain("fair, rubric-faithful academic marking assistant");
    expect(bundle.prompt).toContain("Submission evidence:");
    expect(bundle.requestDiagnostics.prompt_injection_suspected).toBe(false);
    expect(bundle.assignmentType).toBe("Report");
  });
});
