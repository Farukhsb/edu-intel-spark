// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildReleasedGradeContext, buildWeaknessGuidance } from "../../supabase/functions/_shared/explain-grade-context";
import {
  buildExplainGradeSystemPrompt,
  buildWeaknessIntentInstruction,
  buildWeaknessRankingResponse,
  hasWeaknessIntent,
} from "../../supabase/functions/_shared/explain-grade-prompt";

const makeError = (status: number, message: string) => Object.assign(new Error(message), { status });

const releasedRows = {
  submission: {
    id: "6f951f5c-2665-48c8-b404-3ef9b6288882",
    assignment_id: "985386a6-9981-48eb-8277-568b0ec4957f",
    student_id: "student-1",
    file_name: "essay.pdf",
    status: "released",
  },
  grade: {
    id: "grade-1",
    submission_id: "6f951f5c-2665-48c8-b404-3ef9b6288882",
    final_score: 74,
    final_feedback: "Released feedback",
    ai_feedback: "Draft AI feedback",
    ai_breakdown: [{ criterion: "Argument", score: 18, max_score: 25 }],
    grading_confidence: 0.82,
  },
  assignment: {
    id: "985386a6-9981-48eb-8277-568b0ec4957f",
    module_code: "ENG101",
    title: "Critical Essay",
    max_score: 100,
  },
};

describe("released explain-grade context", () => {
  it("allows a student to explain their own released grade", () => {
    const context = buildReleasedGradeContext(releasedRows, "student-1", makeError);

    expect(context).toMatchObject({
      submissionId: releasedRows.submission.id,
      gradeId: "grade-1",
      assessment: "ENG101 Critical Essay",
      status: "released",
      totalGrade: 74,
      feedback: "Released feedback",
    });
    expect(context.evidenceSummary).toMatchObject({
      evidenceQuality: "moderate",
      criterionCount: 1,
      hasStructuredBreakdown: true,
      hasFeedback: true,
      gradingConfidence: 0.82,
    });
  });

  it("prefers final feedback over draft AI feedback for released explanations", () => {
    const context = buildReleasedGradeContext(
      {
        ...releasedRows,
        grade: {
          ...releasedRows.grade,
          final_feedback: "Lecturer-reviewed released feedback",
          ai_feedback: "Older draft AI feedback",
        },
      },
      "student-1",
      makeError,
    );

    expect(context.feedback).toBe("Lecturer-reviewed released feedback");
  });

  it("orders criterion insights by percentage lost, not raw points lost", () => {
    const context = buildReleasedGradeContext(
      {
        ...releasedRows,
        grade: {
          ...releasedRows.grade,
          ai_breakdown: [
            { criterion: "Breadth", score: 21, max_score: 25 },
            { criterion: "Complexity Analysis", score: 11, max_score: 15 },
          ],
        },
      },
      "student-1",
      makeError,
    );

    expect(context.criterionInsights).toEqual([
      {
        criterion: "Complexity Analysis",
        name: "Complexity Analysis",
        score: 11,
        maxScore: 15,
        earnedPercentage: 73.3,
        lostPoints: 4,
        lostPercentage: 26.7,
      },
      {
        criterion: "Breadth",
        name: "Breadth",
        score: 21,
        maxScore: 25,
        earnedPercentage: 84,
        lostPoints: 4,
        lostPercentage: 16,
      },
    ]);
    expect(context.weakestCriterion).toEqual({
      criterion: "Complexity Analysis",
      name: "Complexity Analysis",
      score: 11,
      maxScore: 15,
      earnedPercentage: 73.3,
      lostPoints: 4,
      lostPercentage: 26.7,
    });
  });

  it("builds deterministic weakness guidance from percentage loss", () => {
    const context = buildReleasedGradeContext(
      {
        ...releasedRows,
        grade: {
          ...releasedRows.grade,
          ai_breakdown: [
            { criterion: "Correct Implementation", score: 21, max_score: 25 },
            { criterion: "Complexity Analysis", score: 11, max_score: 15 },
          ],
        },
      },
      "student-1",
      makeError,
    );

    expect(buildWeaknessGuidance(context.weakestCriterion, context.criterionInsights)).toBe(
      "Complexity Analysis is the weakest criterion. The student scored 11/15, meaning they lost 26.7% of available marks. This is higher than the loss in Correct Implementation, where they lost 16%.",
    );
  });

  it("builds a deterministic weakness-ranking response", () => {
    const context = buildReleasedGradeContext(
      {
        ...releasedRows,
        grade: {
          ...releasedRows.grade,
          ai_breakdown: [
            { criterion: "Correct Implementation", score: 21, max_score: 25 },
            { criterion: "Complexity Analysis", score: 11, max_score: 15 },
          ],
        },
      },
      "student-1",
      makeError,
    );

    expect(buildWeaknessRankingResponse(context.weakestCriterion, context.criterionInsights)).toBe(
      "Complexity Analysis is your biggest weakness because you scored 11/15 there, which means you lost 26.7% of the available marks. This is higher than Correct Implementation, where you lost 16% of the available marks. This represents the highest proportional loss across all criteria.",
    );
  });

  it("builds a prompt that fixes Complexity Analysis as the weakest criterion", () => {
    const context = buildReleasedGradeContext(
      {
        ...releasedRows,
        grade: {
          ...releasedRows.grade,
          ai_breakdown: [
            { criterion: "Correct Implementation", score: 21, max_score: 25 },
            { criterion: "Complexity Analysis", score: 11, max_score: 15 },
          ],
        },
      },
      "student-1",
      makeError,
    );
    const prompt = buildExplainGradeSystemPrompt(context, "Which criterion is my biggest weakness, and why?");

    expect(prompt).toContain("The weakest criterion has already been calculated by the system. It is:");
    expect(prompt).toContain("Complexity Analysis.");
    expect(prompt).toContain("Do not recompute the weakest criterion.");
    expect(prompt).toContain(buildWeaknessIntentInstruction());
    expect(prompt).toContain("Treat the structured released grade context as the source of truth.");
    expect(prompt).toContain("Evidence guidance:");
    expect(prompt).toContain(
      "Complexity Analysis is the weakest criterion. The student scored 11/15, meaning they lost 26.7% of available marks. This is higher than the loss in Correct Implementation, where they lost 16%.",
    );
    expect(prompt).toContain("Do not use raw mark loss.");
    expect(prompt).not.toContain("Always use raw marks");
  });

  it("marks evidence quality as limited when released evidence is sparse", () => {
    const context = buildReleasedGradeContext(
      {
        ...releasedRows,
        grade: {
          ...releasedRows.grade,
          final_feedback: "",
          ai_feedback: "",
          ai_breakdown: [],
          grading_confidence: 0.55,
        },
      },
      "student-1",
      makeError,
    );
    const prompt = buildExplainGradeSystemPrompt(context, "Why did I get this mark?");

    expect(context.evidenceSummary).toMatchObject({
      evidenceQuality: "limited",
      criterionCount: 0,
      hasStructuredBreakdown: false,
      hasFeedback: false,
      gradingConfidence: 0.55,
    });
    expect(context.evidenceSummary.evidenceWarnings).toContain("No structured criterion breakdown is available.");
    expect(prompt).toContain("Evidence quality is limited. Do not guess.");
    expect(prompt).toContain("If a detail is missing from the released context, say it is unavailable instead of inferring it.");
  });

  it("detects weakness-ranking intent phrases", () => {
    expect(hasWeaknessIntent("Which criterion is my biggest weakness?")).toBe(true);
    expect(hasWeaknessIntent("What should I improve first?")).toBe(true);
    expect(hasWeaknessIntent("How can I revise this assignment?")).toBe(false);
  });

  it("exposes weakest criterion with the expected fields", () => {
    const context = buildReleasedGradeContext(
      {
        ...releasedRows,
        grade: {
          ...releasedRows.grade,
          ai_breakdown: [
            { criterion: "Correct Implementation", score: 21, max_score: 25 },
            { criterion: "Complexity Analysis", score: 11, max_score: 15 },
          ],
        },
      },
      "student-1",
      makeError,
    );

    expect(context.weakestCriterion).toEqual({
      criterion: "Complexity Analysis",
      name: "Complexity Analysis",
      score: 11,
      maxScore: 15,
      earnedPercentage: 73.3,
      lostPoints: 4,
      lostPercentage: 26.7,
    });
  });

  it("rejects unreleased grades without exposing AI feedback", () => {
    expect(() =>
      buildReleasedGradeContext(
        {
          ...releasedRows,
          submission: { ...releasedRows.submission, status: "approved" },
          grade: { ...releasedRows.grade, ai_feedback: "Unreleased private AI feedback" },
        },
        "student-1",
        makeError,
      ),
    ).toThrow(/Grade is not released/);

    try {
      buildReleasedGradeContext(
        {
          ...releasedRows,
          submission: { ...releasedRows.submission, status: "approved" },
          grade: { ...releasedRows.grade, ai_feedback: "Unreleased private AI feedback" },
        },
        "student-1",
        makeError,
      );
    } catch (error) {
      expect((error as Error).message).not.toMatch(/private AI feedback/i);
      expect((error as Error & { status: number }).status).toBe(403);
    }
  });

  it("rejects another student's grade", () => {
    try {
      buildReleasedGradeContext(releasedRows, "student-2", makeError);
      throw new Error("Expected access check to fail");
    } catch (error) {
      expect((error as Error).message).toBe("Forbidden");
      expect((error as Error & { status: number }).status).toBe(403);
    }
  });

  it("uses server-side grade rows instead of fake browser gradeContext", () => {
    const fakeBrowserGradeContext = {
      totalGrade: 100,
      feedback: "Fake browser feedback",
      breakdown: [{ criterion: "Fake", score: 100, max_score: 100 }],
    };
    const context = buildReleasedGradeContext(releasedRows, "student-1", makeError);

    expect(context.totalGrade).toBe(74);
    expect(context.feedback).toBe("Released feedback");
    expect(JSON.stringify(context)).not.toContain(fakeBrowserGradeContext.feedback);
  });
});
