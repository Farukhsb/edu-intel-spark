import fs from "node:fs";
import path from "node:path";

export const fixturePath = path.resolve("benchmarks", "database-normalisation-benchmark.json");

export const normalizeScore = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
};

export const loadFixture = (customFixturePath = fixturePath) =>
  JSON.parse(fs.readFileSync(customFixturePath, "utf8"));

export const loadResultsMap = (resultsPath) => {
  if (!resultsPath) return new Map();

  const raw = JSON.parse(fs.readFileSync(path.resolve(resultsPath), "utf8"));
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw.results) ? raw.results : [];

  return new Map(
    rows
      .map((row) => {
        const submissionId = row.submission_id ?? row.submissionId ?? row.id ?? null;
        const aiScore = normalizeScore(row.ai_score ?? row.aiScore ?? row.final_score ?? row.finalScore ?? null);
        const notes = typeof row.notes === "string" ? row.notes.trim() : "";

        return submissionId
          ? [
              submissionId,
              {
                aiScore,
                notes,
              },
            ]
          : null;
      })
      .filter(Boolean),
  );
};

export const getGradeBandLabel = (fixture, score) => {
  if (score == null) return null;

  const match = fixture.grade_bands.find((band) => score >= band.min_score && score <= band.max_score);
  return match?.label ?? null;
};

export const buildBenchmarkReport = (fixture, resultsById) => {
  const rows = fixture.submissions.map((submission) => {
    const expectedScore = submission.expected_manual_score;
    const expectedBand = submission.expected_grade_band;
    const result = resultsById.get(submission.submission_id) ?? { aiScore: null, notes: "" };
    const aiScore = result.aiScore;
    const aiBand = getGradeBandLabel(fixture, aiScore);
    const absoluteError = aiScore == null ? null : Math.abs(aiScore - expectedScore);
    const signedDelta = aiScore == null ? null : aiScore - expectedScore;
    const withinFive = absoluteError == null ? null : absoluteError <= 5;
    const withinTen = absoluteError == null ? null : absoluteError <= 10;
    const bandMatch = aiBand == null ? null : aiBand === expectedBand;

    return {
      submissionId: submission.submission_id,
      expectedScore,
      expectedBand,
      aiScore,
      aiBand,
      absoluteError,
      signedDelta,
      withinFive,
      withinTen,
      bandMatch,
      notes: result.notes || (aiScore == null ? `Expected band: ${expectedBand}` : ""),
    };
  });

  const scoredRows = rows.filter((row) => row.aiScore != null);
  const meanAbsoluteError =
    scoredRows.length === 0
      ? null
      : Number(
          (
            scoredRows.reduce((total, row) => total + (row.absoluteError ?? 0), 0) /
            scoredRows.length
          ).toFixed(2),
        );
  const meanSignedError =
    scoredRows.length === 0
      ? null
      : Number(
          (
            scoredRows.reduce((total, row) => total + (row.signedDelta ?? 0), 0) /
            scoredRows.length
          ).toFixed(2),
        );

  const summary = {
    comparedRows: scoredRows.length,
    totalRows: rows.length,
    meanAbsoluteError,
    meanSignedError,
    withinFiveCount: scoredRows.filter((row) => row.withinFive).length,
    withinTenCount: scoredRows.filter((row) => row.withinTen).length,
    exactBandMatches: scoredRows.filter((row) => row.bandMatch).length,
    overscoredCount: scoredRows.filter((row) => (row.signedDelta ?? 0) > 0).length,
    underscoredCount: scoredRows.filter((row) => (row.signedDelta ?? 0) < 0).length,
  };

  return { rows, summary };
};

export const renderMarkdownReport = (fixture, report) => {
  const header = [
    `# ${fixture.benchmark_name}`,
    "",
    `Assignment: ${fixture.assignment.title} (${fixture.assignment.module_code})`,
    "",
    "| Submission ID | Expected Score | Expected Band | AI Score | AI Band | Absolute Error | Delta | Within 5 | Band Match | Notes |",
    "| --- | ---: | --- | ---: | --- | ---: | ---: | :---: | :---: | --- |",
  ];

  const lines = report.rows.map((row) => {
    const withinFive = row.withinFive == null ? "" : row.withinFive ? "Yes" : "No";
    const bandMatch = row.bandMatch == null ? "" : row.bandMatch ? "Yes" : "No";

    return `| ${row.submissionId} | ${row.expectedScore} | ${row.expectedBand} | ${row.aiScore ?? ""} | ${row.aiBand ?? ""} | ${row.absoluteError ?? ""} | ${row.signedDelta ?? ""} | ${withinFive} | ${bandMatch} | ${row.notes} |`;
  });

  const { summary } = report;
  const comparedRows = summary.comparedRows;
  const exactBandMatchRate =
    comparedRows === 0 ? "n/a" : `${summary.exactBandMatches}/${comparedRows} (${Math.round((summary.exactBandMatches / comparedRows) * 100)}%)`;

  return [
    ...header,
    ...lines,
    "",
    "Summary",
    `- Compared rows: ${summary.comparedRows}/${summary.totalRows}`,
    `- Mean absolute error: ${summary.meanAbsoluteError ?? "n/a"}`,
    `- Mean signed error: ${summary.meanSignedError ?? "n/a"}`,
    `- Within 5 marks: ${summary.withinFiveCount}/${summary.comparedRows}`,
    `- Within 10 marks: ${summary.withinTenCount}/${summary.comparedRows}`,
    `- Exact grade-band matches: ${exactBandMatchRate}`,
    `- Overscored rows: ${summary.overscoredCount}`,
    `- Underscored rows: ${summary.underscoredCount}`,
  ].join("\n");
};
