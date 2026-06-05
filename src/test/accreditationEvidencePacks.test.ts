import { describe, expect, it } from "vitest";

import {
  buildOfsB3EvidencePackMarkdown,
  buildTefNarrativeSubmissionMarkdown,
} from "@/lib/accreditationEvidencePacks";
import type { FeedbackTurnaroundSummary, NSSMetric, QAAMetric, TEFIndicator } from "@/lib/accreditationMetrics";

const qaaMetrics: QAAMetric[] = [
  { id: "completion", category: "Student Engagement", metric: "Assessment Completion Rate", value: 88, target: 85, status: "met", detail: "88/100 submissions across 12 assignments" },
  { id: "grade-release", category: "Feedback Quality", metric: "Grade Release Rate", value: 92, target: 95, status: "at-risk", detail: "92/100 grades released to students" },
  { id: "moderation", category: "Quality Assurance", metric: "Moderation Evidence", value: 96, target: 100, status: "met", detail: "96/100 grades have lecturer review/moderation" },
  { id: "pass-rate", category: "Student Outcomes", metric: "Module Pass Rate", value: 81, target: 75, status: "met", detail: "81/100 students passed (>=40%)" },
  { id: "avg-score", category: "Student Outcomes", metric: "Average Assessment Score", value: 62, target: 55, status: "met", detail: "Mean score across all graded submissions" },
  { id: "graded", category: "Quality Assurance", metric: "Graded Submissions", value: 90, target: 95, status: "at-risk", detail: "90/100 submissions graded" },
];

const nssMetrics: NSSMetric[] = [
  { question: "The course is well organised", score: 83, benchmark: 77, trend: "+6%" },
];

const tefIndicators: TEFIndicator[] = [
  { name: "Teaching Quality", rating: "silver", score: 74, detail: "Based on rubric clarity, feedback quality, and organisation" },
  { name: "Student Outcomes", rating: "silver", score: 78, detail: "Pass rate and average score" },
];

const feedbackTurnaround: FeedbackTurnaroundSummary = {
  avg: 12,
  target: 15,
  compliant: 9,
  total: 10,
};

describe("accreditation evidence packs", () => {
  it("builds an OfS B3 evidence pack with continuation, completion, and progression narratives", () => {
    const pack = buildOfsB3EvidencePackMarkdown({
      institutionName: "Example University",
      generatedAt: "2026-06-05",
      qaaMetrics,
      nssMetrics,
      tefIndicators,
      feedbackTurnaround,
      summary: {
        overallCompliance: 80,
        metCount: 4,
        atRiskCount: 2,
        belowCount: 0,
        nssAverage: 83,
        nssBenchmarkAverage: 77,
        weakestQaaMetric: qaaMetrics[1],
        weakestTefIndicator: tefIndicators[0],
      },
    });

    expect(pack).toContain("# OfS B3 Evidence Pack");
    expect(pack).toContain("Continuation");
    expect(pack).toContain("Completion");
    expect(pack).toContain("Progression");
    expect(pack.toLowerCase()).toContain("assessment completion rate is 88%");
    expect(pack.toLowerCase()).toContain("grade release rate is 92%");
    expect(pack.toLowerCase()).toContain("pass rate is 81%");
  });

  it("builds a TEF narrative submission pack with indicator and narrative sections", () => {
    const pack = buildTefNarrativeSubmissionMarkdown({
      institutionName: "Example University",
      generatedAt: "2026-06-05",
      qaaMetrics,
      nssMetrics,
      tefIndicators,
      feedbackTurnaround,
      summary: {
        overallCompliance: 80,
        metCount: 4,
        atRiskCount: 2,
        belowCount: 0,
        nssAverage: 83,
        nssBenchmarkAverage: 77,
        weakestQaaMetric: qaaMetrics[1],
        weakestTefIndicator: tefIndicators[0],
      },
    });

    expect(pack).toContain("# TEF Narrative Submission Pack");
    expect(pack).toContain("Teaching & Learning Narrative");
    expect(pack).toContain("Student Outcomes Narrative");
    expect(pack).toContain("Assessment and Feedback Narrative");
    expect(pack).toContain("Teaching Quality");
    expect(pack).toContain("Feedback turnaround averages 12 days");
  });
});
