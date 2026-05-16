// @vitest-environment node

import { describe, expect, it } from "vitest";

import { mapWithConcurrency } from "../../supabase/functions/check-plagiarism/map-with-concurrency";

describe("mapWithConcurrency", () => {
  it("preserves input order while mapping in parallel", async () => {
    const result = await mapWithConcurrency([3, 1, 2], 2, async (value) => {
      await new Promise((resolve) => setTimeout(resolve, value));
      return value * 10;
    });

    expect(result).toEqual([30, 10, 20]);
  });

  it("does not exceed the configured concurrency", async () => {
    let active = 0;
    let peak = 0;

    await mapWithConcurrency([1, 2, 3, 4, 5], 3, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, value));
      active -= 1;
      return value;
    });

    expect(peak).toBeLessThanOrEqual(3);
  });
});
