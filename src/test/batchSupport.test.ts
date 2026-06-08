// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("npm:mammoth", () => ({
  default: {
    extractRawText: vi.fn(),
  },
}));

import {
  getConfiguredGradingPasses,
  getPassSpreadThreshold,
  resolveGradingPasses,
  getWorkflowRunGradingPassCount,
} from "../../supabase/functions/grade-submission/batch-support";

describe("grade-submission batch support", () => {
  it("clamps grading pass settings and spread thresholds", () => {
    const originalDeno = globalThis.Deno;
    globalThis.Deno = {
      env: {
        get: (name: string) => (name === "OPENAI_GRADING_PASSES" ? "4" : undefined),
      },
    } as typeof Deno;

    expect(getConfiguredGradingPasses()).toBe(4);
    expect(resolveGradingPasses(2)).toBe(2);
    expect(resolveGradingPasses(undefined)).toBe(4);
    expect(getPassSpreadThreshold(100)).toBe(8);
    expect(getWorkflowRunGradingPassCount(0)).toBe(1);

    globalThis.Deno = originalDeno;
    vi.restoreAllMocks();
  });
});
