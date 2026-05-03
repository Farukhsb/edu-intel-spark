import { describe, expect, it } from "vitest";

import {
  buildIntegrityClientOutcome,
  deriveIntegrityCardPresentation,
} from "@/pages/dashboard/assignment-detail/integrityUi";
import type { PlagiarismFlag } from "@/pages/dashboard/assignment-detail/types";

const SAMPLE_FLAG: PlagiarismFlag = {
  student_a: "Student A",
  student_b: "Student B",
  submission_a_id: "11111111-1111-4111-8111-111111111111",
  submission_b_id: "22222222-2222-4222-8222-222222222222",
  similarity_score: 82,
  ai_suspicion_score: 0,
  baseline_deviation_score: 0,
  total_risk_score: 82,
  reason: "Substantial uncited overlap detected.",
  evidence_summary: "Matched internal peer phrasing.",
  matched_excerpt: "Shared paragraph structure",
  recommended_action: "review",
  integrity_type: "similarity",
  severity: "high",
};

describe("integrity UI helpers", () => {
  it("builds a limited outcome when warnings exist without flags", () => {
    const outcome = buildIntegrityClientOutcome({
      flags: [],
      summaries: ["No submissions crossed the current integrity thresholds."],
      warnings: ["Large assignment cohort detected (42 submissions). Integrity analysis may take longer than usual."],
      failedBatches: 0,
    });

    expect(outcome.toastTone).toBe("warning");
    expect(outcome.toastMessage).toContain("Large assignment cohort detected");
    expect(outcome.summary).toContain("No submissions crossed the current integrity thresholds.");
  });

  it("builds a flagged outcome with limitation wording when both are present", () => {
    const outcome = buildIntegrityClientOutcome({
      flags: [SAMPLE_FLAG],
      summaries: ["Potential overlap requires lecturer review."],
      warnings: ["Internal similarity evidence could not be stored, but analysis completed."],
      failedBatches: 0,
    });

    expect(outcome.toastTone).toBe("warning");
    expect(outcome.toastMessage).toBe("1 potential issue(s) flagged. Analysis completed with limitations.");
  });

  it("derives a visible limited card when only the summary indicates degraded coverage", () => {
    const presentation = deriveIntegrityCardPresentation({
      flags: [],
      summary:
        "Internal cohort similarity scanning was skipped because this assignment has 81 submissions, exceeding the current safety limit of 80.",
    });

    expect(presentation.shouldShowCard).toBe(true);
    expect(presentation.cardTone).toBe("limited");
    expect(presentation.badgeLabel).toBe("Limited coverage");
  });
});
