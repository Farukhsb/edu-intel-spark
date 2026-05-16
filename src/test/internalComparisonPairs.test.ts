// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildInternalComparisonPairs } from "../../supabase/functions/check-plagiarism/internal-comparison-pairs";

describe("internal comparison pair selection", () => {
  it("only returns pairs touching the requested submission set", () => {
    const comparableSubmissions = [
      { submission: { id: "sub-a" }, content: { plainText: "A" } },
      { submission: { id: "sub-b" }, content: { plainText: "B" } },
      { submission: { id: "sub-c" }, content: { plainText: "C" } },
      { submission: { id: "sub-d" }, content: { plainText: "D" } },
    ];

    const pairs = buildInternalComparisonPairs(comparableSubmissions, new Set(["sub-c"]));

    expect(
      pairs.map(({ left, right }) => [left.submission.id, right.submission.id]),
    ).toEqual([
      ["sub-a", "sub-c"],
      ["sub-b", "sub-c"],
      ["sub-c", "sub-d"],
    ]);
  });

  it("still returns all unique pairs when every submission is requested", () => {
    const comparableSubmissions = [
      { submission: { id: "sub-a" }, content: { plainText: "A" } },
      { submission: { id: "sub-b" }, content: { plainText: "B" } },
      { submission: { id: "sub-c" }, content: { plainText: "C" } },
    ];

    const pairs = buildInternalComparisonPairs(
      comparableSubmissions,
      new Set(["sub-a", "sub-b", "sub-c"]),
    );

    expect(
      pairs.map(({ left, right }) => [left.submission.id, right.submission.id]),
    ).toEqual([
      ["sub-a", "sub-b"],
      ["sub-a", "sub-c"],
      ["sub-b", "sub-c"],
    ]);
  });
});
