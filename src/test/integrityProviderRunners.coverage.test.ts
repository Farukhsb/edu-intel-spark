// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  runInternalSimilarityComparisons,
  runMossSimilarityComparisons,
} from "../../supabase/functions/_shared/integrity-provider-runners";

const mocks = vi.hoisted(() => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  analyzeTextSimilarity: vi.fn(),
  detectMossLanguage: vi.fn(),
  groupMossComparableSubmissions: vi.fn(),
  runMossSimilarityJob: vi.fn(),
}));

vi.mock("../../supabase/functions/_shared/log.ts", () => ({
  logInfo: mocks.logInfo,
  logWarn: mocks.logWarn,
  logError: mocks.logError,
}));

vi.mock("../../supabase/functions/_shared/providers/internal-text-similarity.ts", () => ({
  analyzeTextSimilarity: mocks.analyzeTextSimilarity,
}));

vi.mock("../../supabase/functions/_shared/providers/moss.ts", () => ({
  detectMossLanguage: mocks.detectMossLanguage,
  groupMossComparableSubmissions: mocks.groupMossComparableSubmissions,
  runMossSimilarityJob: mocks.runMossSimilarityJob,
}));

describe("integrity provider runners coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("covers internal similarity success, skip, and failure branches", async () => {
    mocks.analyzeTextSimilarity
      .mockReturnValueOnce({
        provider: "internal_text_similarity",
        assignment_id: "assignment-1",
        submission_id: "submission-1",
        compared_submission_id: "submission-2",
        similarity_score: 64,
        severity: "medium",
        evidence_summary: "Matched phrasing",
        matched_phrases: ["matched"],
        raw_metadata: {},
        analysis_limited: false,
      })
      .mockImplementationOnce(() => {
        throw new Error("pair failed");
      });
    mocks.analyzeTextSimilarity.mockReturnValueOnce({
      provider: "internal_text_similarity",
      assignment_id: "assignment-1",
      submission_id: "submission-2",
      compared_submission_id: "submission-3",
      similarity_score: 41,
      severity: "low",
      evidence_summary: "Secondary match",
      matched_phrases: ["secondary"],
      raw_metadata: {},
      analysis_limited: false,
    });

    const warnings: string[] = [];
    const findings = await runInternalSimilarityComparisons({
      assignmentId: "assignment-1",
      submissions: [
        { id: "submission-1", assignment_id: "assignment-1", student_id: null, student_name: null, student_email: null, file_name: "a.txt" },
        { id: "submission-2", assignment_id: "assignment-1", student_id: null, student_name: null, student_email: null, file_name: "b.txt" },
        { id: "submission-3", assignment_id: "assignment-1", student_id: null, student_name: null, student_email: null, file_name: "c.txt" },
        { id: "submission-4", assignment_id: "assignment-1", student_id: null, student_name: null, student_email: null, file_name: "d.txt" },
        { id: "submission-5", assignment_id: "assignment-1", student_id: null, student_name: null, student_email: null, file_name: "e.txt" },
      ],
      contentMap: new Map([
        ["submission-1", { plainText: "alpha", fileType: "text/plain", success: true, extractionError: null }],
        ["submission-2", { plainText: "bravo", fileType: "text/plain", success: true, extractionError: null }],
        ["submission-3", { plainText: "charlie", fileType: "text/plain", success: true, extractionError: null }],
        ["submission-5", { plainText: "delta", fileType: "text/plain", success: true, extractionError: null }],
      ]),
      supportsInternalTextSimilarity: (content) => content.plainText !== "delta",
      warnings,
    });

    expect(findings).toHaveLength(2);
    expect(mocks.logInfo).toHaveBeenCalledWith(
      "internal_similarity_started",
        expect.objectContaining({
          assignmentId: "assignment-1",
        submissionCount: 5,
        comparableSubmissionCount: 3,
      }),
    );
    expect(mocks.logError).toHaveBeenCalledWith(
      "internal_similarity_pair_failed",
      expect.any(Error),
      expect.objectContaining({
        assignmentId: "assignment-1",
        leftSubmissionId: "submission-1",
        rightSubmissionId: "submission-3",
      }),
    );
    expect(warnings).toEqual([
      "A pairwise internal similarity comparison failed and was skipped.",
    ]);
    expect(mocks.logInfo).toHaveBeenCalledWith(
      "internal_similarity_completed",
      expect.objectContaining({
        assignmentId: "assignment-1",
        findingCount: 2,
      }),
    );
  });

  it("covers moss grouping, source skip, success, and failure branches", async () => {
    mocks.detectMossLanguage.mockImplementation((fileName: string | null | undefined) => {
      if (fileName === "skip.txt") return null;
      if (fileName === "python.py") return "python";
      if (fileName === "python-2.py") return "python";
      if (fileName === "ruby.rb") return "ruby";
      if (fileName === "ruby-2.rb") return "ruby";
      return null;
    });

    mocks.groupMossComparableSubmissions.mockReturnValue([
      {
        language: "python",
        comparableSubmissions: [
          {
            submissionId: "submission-1",
            fileName: "python.py",
            sourceText: "print('hello')",
            studentName: "One",
            studentEmail: "one@example.com",
            language: "python",
          },
          {
            submissionId: "submission-2",
            fileName: "python-2.py",
            sourceText: "print('hello again')",
            studentName: "Two",
            studentEmail: "two@example.com",
            language: "python",
          },
        ],
      },
      {
        language: "ruby",
        comparableSubmissions: [
          {
            submissionId: "submission-3",
            fileName: "ruby.rb",
            sourceText: "puts 'hi'",
            studentName: "Three",
            studentEmail: "three@example.com",
            language: "ruby",
          },
          {
            submissionId: "submission-4",
            fileName: "ruby-2.rb",
            sourceText: "puts 'hey'",
            studentName: "Four",
            studentEmail: "four@example.com",
            language: "ruby",
          },
        ],
      },
    ]);

    mocks.runMossSimilarityJob
      .mockResolvedValueOnce([
        {
          provider: "moss",
          assignment_id: "assignment-2",
          submission_id: "submission-1",
          compared_submission_id: "submission-2",
          similarity_score: 87,
          severity: "high",
          evidence_summary: "MOSS match",
          matched_phrases: ["match"],
          raw_metadata: { report_url: "https://example.com/report" },
          analysis_limited: false,
        },
      ])
      .mockRejectedValueOnce(new Error("runner down"));

    const warnings: string[] = [];
    const findings = await runMossSimilarityComparisons({
      assignmentId: "assignment-2",
      submissions: [
        { id: "submission-1", assignment_id: "assignment-2", student_id: null, student_name: "One", student_email: "one@example.com", file_name: "python.py" },
        { id: "submission-2", assignment_id: "assignment-2", student_id: null, student_name: "Two", student_email: "two@example.com", file_name: "python-2.py" },
        { id: "submission-3", assignment_id: "assignment-2", student_id: null, student_name: "Three", student_email: "three@example.com", file_name: "ruby.rb" },
        { id: "submission-4", assignment_id: "assignment-2", student_id: null, student_name: "Four", student_email: "four@example.com", file_name: "ruby-2.rb" },
        { id: "submission-5", assignment_id: "assignment-2", student_id: null, student_name: "Five", student_email: "five@example.com", file_name: "skip.txt" },
      ],
      config: {
        runnerUrl: "https://moss.example.com",
        apiKey: "secret",
        timeoutMs: 25,
      },
      fetchCodeSubmissionSource: async (submission) =>
        submission.id === "submission-4" ? null : `source:${submission.id}`,
      warnings,
    });

    expect(findings).toHaveLength(1);
    expect(mocks.logWarn).toHaveBeenCalledWith(
      "moss_source_unavailable",
      expect.objectContaining({
        assignmentId: "assignment-2",
        submissionId: "submission-4",
        fileName: "ruby-2.rb",
      }),
    );
    expect(mocks.logInfo).toHaveBeenCalledWith(
      "moss_similarity_started",
      expect.objectContaining({
        assignmentId: "assignment-2",
        submissionCount: 5,
        comparableSubmissionCount: 3,
        languageGroupCount: 2,
      }),
    );
    expect(mocks.logError).toHaveBeenCalledWith(
      "moss_similarity_failed",
      expect.any(Error),
      expect.objectContaining({
        assignmentId: "assignment-2",
        language: "ruby",
        comparableSubmissionCount: 2,
      }),
    );
    expect(warnings).toEqual([
      "MOSS code similarity analysis was unavailable, but existing plagiarism analysis completed.",
    ]);
    expect(mocks.logInfo).toHaveBeenCalledWith(
      "moss_similarity_completed",
      expect.objectContaining({
        assignmentId: "assignment-2",
        findingCount: 1,
      }),
    );
  });
});
