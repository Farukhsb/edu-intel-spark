import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateRiskPredictions } from "./evaluation-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const defaultInput = resolve(repoRoot, "tools/risk-model/generated/risk-training-data.jsonl");

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function parseJsonl(path) {
  const raw = readFileSync(path, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function main() {
  const inputPath = resolve(process.cwd(), getArg("--input") ?? defaultInput);
  const binCount = Number.parseInt(getArg("--bins") ?? "10", 10);
  const positiveClass = getArg("--positive-class") ?? "high";

  if (!existsSync(inputPath)) {
    console.error(`No labeled risk dataset found at ${inputPath}.`);
    console.error("Run `npm run risk:export` first, then rerun `npm run risk:evaluate`.");
    process.exit(1);
  }

  const rows = parseJsonl(inputPath)
    .map((row) => ({
      actualBand: row.label_value,
      predictedBand: row.risk_band,
      confidence: row.risk_score,
    }))
    .filter((row) => row.actualBand && row.predictedBand);

  const summary = evaluateRiskPredictions(rows, { binCount, positiveClass });

  console.log(JSON.stringify({
    inputPath,
    count: summary.count,
    accuracy: summary.accuracy,
    macroPrecision: summary.macroPrecision,
    macroRecall: summary.macroRecall,
    macroF1: summary.macroF1,
    perClass: summary.perClass,
    confusionMatrix: summary.confusionMatrix,
    calibration: summary.calibration,
  }, null, 2));

  console.log("");
  console.log(`Accuracy: ${formatPercent(summary.accuracy)}`);
  console.log(`Macro F1: ${formatPercent(summary.macroF1)}`);
  console.log(`Expected calibration error: ${(summary.calibration.expectedCalibrationError * 100).toFixed(2)}%`);
}

main();
