import {
  buildBenchmarkReport,
  loadFixture,
  loadResultsMap,
  renderMarkdownReport,
} from "./score-benchmark-lib.mjs";

const args = process.argv.slice(2);
const resultsPath = args[0] ?? null;
const fixture = loadFixture();
const resultsById = loadResultsMap(resultsPath);
const report = buildBenchmarkReport(fixture, resultsById);

console.log(renderMarkdownReport(fixture, report));
