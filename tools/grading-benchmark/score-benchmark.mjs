import fs from "node:fs";
import path from "node:path";

const fixturePath = path.resolve("benchmarks", "database-normalisation-benchmark.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

const args = process.argv.slice(2);
const resultsPath = args[0] ? path.resolve(args[0]) : null;

const normalizeScore = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
};

const loadResults = () => {
  if (!resultsPath) return new Map();

  const raw = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw.results) ? raw.results : [];
  return new Map(
    rows
      .map((row) => {
        const submissionId = row.submission_id ?? row.submissionId ?? row.id ?? null;
        const aiScore = normalizeScore(row.ai_score ?? row.aiScore ?? row.final_score ?? row.finalScore ?? null);
        return submissionId ? [submissionId, aiScore] : null;
      })
      .filter(Boolean),
  );
};

const resultsById = loadResults();

const header = [
  "| Submission ID | Expected Score | AI Score | Absolute Error | Within 5 Marks | Notes |",
  "| --- | ---: | ---: | ---: | :---: | --- |",
];

const lines = fixture.submissions.map((submission) => {
  const expected = submission.expected_manual_score;
  const aiScore = resultsById.get(submission.submission_id);
  const absoluteError = aiScore == null ? "" : Math.abs(aiScore - expected);
  const withinFive = aiScore == null ? "" : absoluteError <= 5 ? "Yes" : "No";
  const notes = aiScore == null ? `Expected band: ${submission.expected_grade_band}` : "";

  return `| ${submission.submission_id} | ${expected} | ${aiScore ?? ""} | ${absoluteError} | ${withinFive} | ${notes} |`;
});

console.log(`# ${fixture.benchmark_name}`);
console.log("");
console.log(`Assignment: ${fixture.assignment.title} (${fixture.assignment.module_code})`);
console.log("");
console.log(header.join("\n"));
console.log(lines.join("\n"));

if (resultsById.size > 0) {
  const scoredRows = fixture.submissions.filter((submission) => resultsById.get(submission.submission_id) != null);
  const withinFiveCount = scoredRows.filter((submission) => {
    const aiScore = resultsById.get(submission.submission_id);
    return aiScore != null && Math.abs(aiScore - submission.expected_manual_score) <= 5;
  }).length;
  const meanAbsoluteError =
    scoredRows.length === 0
      ? null
      : (
          scoredRows.reduce((total, submission) => {
            const aiScore = resultsById.get(submission.submission_id);
            return total + Math.abs((aiScore ?? 0) - submission.expected_manual_score);
          }, 0) / scoredRows.length
        ).toFixed(2);

  console.log("");
  console.log("Summary");
  console.log(`- Compared rows: ${scoredRows.length}/${fixture.submissions.length}`);
  console.log(`- Mean absolute error: ${meanAbsoluteError ?? "n/a"}`);
  console.log(`- Within 5 marks: ${withinFiveCount}/${scoredRows.length}`);
}
