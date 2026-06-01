import { evaluateModerationSignals } from "@/lib/moderation";

describe("moderation signal evaluation", () => {
  it("triggers moderation for low confidence and large score variance", () => {
    const result = evaluateModerationSignals({
      grade: {
        ai_score: 72,
        lecturer_score: 58,
        lecturer_feedback: null,
        grading_confidence: 0.52,
        grading_metadata: null,
        ai_breakdown: null,
        ai_feedback: null,
      },
      integrityReview: null,
      maxScore: 100,
    });

    expect(result.needsModeration).toBe(true);
    expect(result.triggerFlags).toEqual(
      expect.arrayContaining(["low_confidence", "score_variance"]),
    );
  });

  it("triggers moderation for boundary scores close to classification thresholds", () => {
    const result = evaluateModerationSignals({
      grade: {
        ai_score: 49,
        lecturer_score: 50,
        lecturer_feedback: null,
        grading_confidence: 0.9,
        grading_metadata: null,
        ai_breakdown: null,
        ai_feedback: null,
      },
      integrityReview: null,
      maxScore: 100,
    });

    expect(result.triggerFlags).toContain("boundary_score");
  });

  it("skips boundary and low-confidence moderation triggers during lecturer review", () => {
    const result = evaluateModerationSignals({
      grade: {
        ai_score: 39,
        lecturer_score: 39,
        lecturer_feedback: null,
        grading_confidence: 0.5,
        grading_metadata: null,
        ai_breakdown: null,
        ai_feedback: null,
      },
      integrityReview: null,
      maxScore: 100,
      context: "lecturer_review",
    });

    expect(result.needsModeration).toBe(false);
    expect(result.triggerFlags).not.toEqual(expect.arrayContaining(["low_confidence", "boundary_score"]));
  });

  it("triggers moderation for maths metadata concerns", () => {
    const result = evaluateModerationSignals({
      grade: {
        ai_score: 65,
        lecturer_score: 65,
        lecturer_feedback: null,
        grading_confidence: 0.88,
        grading_metadata: {
          math_analysis: {
            solver_signals: ["Solver-like pattern detected"],
            derivation_checks: [],
          },
        },
        ai_breakdown: null,
        ai_feedback: null,
      },
      integrityReview: null,
      maxScore: 100,
      context: "lecturer_review",
    });

    expect(result.triggerFlags).toContain("maths_concern");
  });

  it("ignores malformed maths metadata without raising false moderation signals", () => {
    const result = evaluateModerationSignals({
      grade: {
        ai_score: 65,
        lecturer_score: 65,
        lecturer_feedback: null,
        grading_confidence: 0.88,
        grading_metadata: {
          math_analysis: {
            solver_signals: [42, "valid signal"],
            derivation_checks: "invalid-shape",
          },
        },
        ai_breakdown: null,
        ai_feedback: null,
      },
      integrityReview: null,
      maxScore: 100,
      context: "lecturer_review",
    });

    expect(result.triggerFlags).not.toContain("maths_concern");
  });
});
