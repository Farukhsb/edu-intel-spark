import { describe, expect, it } from "vitest";

import fixture from "../../benchmarks/database-normalisation-benchmark.json";
import {
  buildCapturedResults,
  matchFixtureSubmissionId,
  normalizeFileStem,
} from "../../tools/grading-benchmark/capture-benchmark-lib.mjs";

describe("grading benchmark capture helpers", () => {
  it("normalizes file names to fixture stems", () => {
    expect(normalizeFileStem("benchmark-dbnorm-01.txt")).toBe("benchmark-dbnorm-01");
    expect(normalizeFileStem(" BENCHMARK-DBNORM-02.MD ")).toBe("benchmark-dbnorm-02");
  });

  it("matches benchmark submission ids from deterministic file names", () => {
    const fixtureMap = new Map(
      fixture.submissions.map((submission) => [submission.submission_id.toLowerCase(), submission]),
    );

    expect(matchFixtureSubmissionId("benchmark-dbnorm-01.txt", fixtureMap)).toBe("benchmark-dbnorm-01");
    expect(matchFixtureSubmissionId("benchmark-dbnorm-02-final.docx", fixtureMap)).toBe("benchmark-dbnorm-02");
    expect(matchFixtureSubmissionId("random-upload.txt", fixtureMap)).toBeNull();
  });

  it("builds a live results payload from submissions and grades", () => {
    const captured = buildCapturedResults({
      fixture,
      assignment: {
        id: "assignment-live-1",
        title: fixture.assignment.title,
        module_code: fixture.assignment.module_code,
        max_score: fixture.assignment.max_score,
        status: "published",
      },
      submissions: [
        {
          id: "sub-live-1",
          file_name: "benchmark-dbnorm-01.txt",
          student_name: "Student One",
          student_email: "one@example.com",
          status: "released",
        },
        {
          id: "sub-live-2",
          file_name: "notes.txt",
          student_name: "Noise",
          student_email: "noise@example.com",
          status: "submitted",
        },
      ],
      grades: [
        {
          submission_id: "sub-live-1",
          ai_score: 75,
          final_score: 76,
          grading_confidence: 0.81,
          reviewed_at: "2026-05-25T09:00:00.000Z",
        },
      ],
      runLabel: "pilot-run",
    });

    expect(captured.summary).toMatchObject({
      fixture_rows: 16,
      matched_rows: 1,
      unmatched_live_submissions: 1,
      duplicate_matches: 0,
    });

    expect(captured.results[0]).toMatchObject({
      submission_id: "benchmark-dbnorm-01",
      live_submission_id: "sub-live-1",
      ai_score: 75,
      final_score: 76,
      grading_confidence: 0.81,
    });

    expect(captured.results[1]).toMatchObject({
      submission_id: "benchmark-dbnorm-02",
      live_submission_id: null,
    });
  });
});
