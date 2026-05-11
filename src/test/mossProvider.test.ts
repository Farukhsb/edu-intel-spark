// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  detectMossLanguage,
  groupMossComparableSubmissions,
  runMossSimilarityJob,
} from "../../supabase/functions/_shared/providers/moss";

describe("moss provider bridge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects supported MOSS languages from code file extensions", () => {
    expect(detectMossLanguage("solution.py")).toBe("python");
    expect(detectMossLanguage("Main.java")).toBe("java");
    expect(detectMossLanguage("report.docx")).toBeNull();
    expect(detectMossLanguage(null)).toBeNull();
  });

  it("groups only comparable submissions with supported languages", () => {
    const groups = groupMossComparableSubmissions([
      {
        submissionId: "a",
        fileName: "one.py",
        sourceText: "print('a')",
        studentName: "A",
        studentEmail: null,
        language: "python",
      },
      {
        submissionId: "b",
        fileName: "two.py",
        sourceText: "print('b')",
        studentName: "B",
        studentEmail: null,
        language: "python",
      },
      {
        submissionId: "c",
        fileName: "three.java",
        sourceText: "class Three {}",
        studentName: "C",
        studentEmail: null,
        language: "java",
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      language: "python",
    });
    expect(groups[0]?.comparableSubmissions).toHaveLength(2);
  });

  it("normalizes findings returned by the external MOSS runner", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reportUrl: "https://moss.example/report/123",
        findings: [
          {
            submission_id: "submission-a",
            compared_submission_id: "submission-b",
            similarity_score: 78,
            evidence_summary: "Substantial overlap in control-flow and helper functions.",
            matched_phrases: ["def validate_input", "for index in range"],
          },
        ],
      }),
    });
    vi.stubGlobal(
      "fetch",
      fetchMock,
    );

    const findings = await runMossSimilarityJob({
      config: {
        runnerUrl: "https://moss-runner.example/jobs",
        apiKey: "runner-secret",
        timeoutMs: 5_000,
      },
      assignmentId: "assignment-1",
      language: "python",
      submissions: [
        {
          submissionId: "submission-a",
          fileName: "one.py",
          sourceText: "print('a')",
          studentName: "A",
          studentEmail: null,
          language: "python",
        },
        {
          submissionId: "submission-b",
          fileName: "two.py",
          sourceText: "print('b')",
          studentName: "B",
          studentEmail: null,
          language: "python",
        },
      ],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      provider: "moss",
      assignment_id: "assignment-1",
      submission_id: "submission-a",
      compared_submission_id: "submission-b",
      similarity_score: 78,
      severity: "medium",
      analysis_limited: false,
    });
    expect(findings[0]?.raw_metadata).toMatchObject({
      language: "python",
      report_url: "https://moss.example/report/123",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://moss-runner.example/jobs",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-api-key": "runner-secret",
        }),
      }),
    );
  });

  it("skips self-match findings returned by the external MOSS runner", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          reportUrl: "https://moss.example/report/456",
          findings: [
            {
              submission_id: "submission-a",
              compared_submission_id: "submission-a",
              similarity_score: 95,
              evidence_summary: "Self match that should be ignored.",
            },
          ],
        }),
      }),
    );

    const findings = await runMossSimilarityJob({
      config: {
        runnerUrl: "https://moss-runner.example/jobs",
        apiKey: "runner-secret",
        timeoutMs: 5_000,
      },
      assignmentId: "assignment-1",
      language: "python",
      submissions: [
        {
          submissionId: "submission-a",
          fileName: "one.py",
          sourceText: "print('a')",
          studentName: "A",
          studentEmail: null,
          language: "python",
        },
        {
          submissionId: "submission-b",
          fileName: "two.py",
          sourceText: "print('b')",
          studentName: "B",
          studentEmail: null,
          language: "python",
        },
      ],
    });

    expect(findings).toEqual([]);
  });
});
