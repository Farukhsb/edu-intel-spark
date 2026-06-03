import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateRiskPredictions } from "./evaluation-core.mjs";

const DEFAULT_SEED = 1337;
const DEFAULT_SAMPLES_PER_CLASS = 200;
const RISK_BANDS = ["low", "medium", "high"];
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const artifactPath = resolve(repoRoot, "src/lib/riskModelArtifact.ts");

function loadRiskModelArtifact() {
  const raw = readFileSync(artifactPath, "utf8");
  const startMarker = "export const riskModelArtifact = ";
  const endMarker = " as const satisfies RiskModelArtifact;";
  const startIndex = raw.indexOf(startMarker);
  const endIndex = raw.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error(`Unable to load risk model artifact from ${artifactPath}`);
  }

  const jsonText = raw.slice(startIndex + startMarker.length, endIndex).trim();
  return JSON.parse(jsonText);
}

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function linearRegression(values) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let index = 0; index < n; index += 1) {
    sumX += index;
    sumY += values[index];
    sumXY += index * values[index];
    sumXX += index * index;
  }

  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values, average) {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function softmax(logits) {
  const maxLogit = Math.max(...logits);
  const expValues = logits.map((value) => Math.exp(value - maxLogit));
  const denominator = expValues.reduce((sum, value) => sum + value, 0) || 1;
  return expValues.map((value) => value / denominator);
}

function applyTemperatureScaling(logits, temperature) {
  const safeTemperature = Number.isFinite(temperature) && temperature > 0 ? temperature : 1;
  return logits.map((value) => value / safeTemperature);
}

function blendWithUniform(probabilities, blendFactor) {
  const safeBlend = clamp(blendFactor, 0, 1);
  const uniform = 1 / Math.max(1, probabilities.length);
  return probabilities.map((probability) => probability * (1 - safeBlend) + uniform * safeBlend);
}

function extractRiskFeatures(trajectory) {
  const scores = trajectory.scores.map((entry) => entry.score);
  const average = mean(scores);
  const last = scores[scores.length - 1] ?? 0;
  const minimum = scores.length > 0 ? Math.min(...scores) : 0;
  const maximum = scores.length > 0 ? Math.max(...scores) : 0;
  const { slope, intercept } = linearRegression(scores);
  const predictedNext = clamp(slope * scores.length + intercept, 0, 100);
  const stdDev = standardDeviation(scores, average);
  const recent3Avg = mean(scores.slice(-3));
  const earlyAvg = mean(scores.slice(0, Math.max(1, Math.floor(scores.length / 2))));
  const firstLastDelta = scores.length > 0 ? last - (scores[0] ?? 0) : 0;
  const recentDelta = scores.length >= 2 ? last - scores[scores.length - 2] : 0;
  const below50Ratio = scores.length > 0 ? scores.filter((score) => score < 50).length / scores.length : 0;
  const below40Ratio = scores.length > 0 ? scores.filter((score) => score < 40).length / scores.length : 0;
  const volatility = stdDev;

  return {
    scoreCount: scores.length,
    average,
    last,
    minimum,
    maximum,
    slope,
    predictedNext,
    stdDev,
    recent3Avg,
    earlyAvg,
    firstLastDelta,
    recentDelta,
    below50Ratio,
    below40Ratio,
    volatility,
  };
}

function normalizeFeatures(artifact, features) {
  return artifact.featureNames.map((featureName, index) => {
    const rawValue = features[featureName] ?? 0;
    const meanValue = artifact.featureMeans[index] ?? 0;
    const stdDev = artifact.featureStdDevs[index] || 1;
    return (rawValue - meanValue) / stdDev;
  });
}

function computeConservatism(features, ranked) {
  const topProbability = ranked[0]?.probability ?? 0;
  const secondProbability = ranked[1]?.probability ?? 0;
  const margin = clamp(topProbability - secondProbability, 0, 1);

  const marginPenalty = clamp((0.5 - margin) / 0.5, 0, 1);
  const historyPenalty = clamp((5 - features.scoreCount) / 5, 0, 1);
  const volatilityPenalty = clamp((features.volatility - 5) / 12, 0, 1);
  const boundaryAveragePenalty = clamp(1 - Math.abs(features.average - 55) / 11, 0, 1);
  const boundaryTrendPenalty = clamp(1 - Math.abs(features.predictedNext - 55) / 13, 0, 1);
  const boundaryPenalty = boundaryAveragePenalty * 0.6 + boundaryTrendPenalty * 0.4;

  return clamp(
    marginPenalty * 0.35 + historyPenalty * 0.15 + volatilityPenalty * 0.15 + boundaryPenalty * 0.35,
    0,
    0.8,
  );
}

function computeBoundarySoftening(features) {
  const boundaryAveragePenalty = clamp(1 - Math.abs(features.average - 55) / 9, 0, 1);
  const boundaryTrendPenalty = clamp(1 - Math.abs(features.predictedNext - 55) / 11, 0, 1);
  const shortHistoryPenalty = clamp((5 - features.scoreCount) / 5, 0, 1);
  const volatilityPenalty = clamp((features.volatility - 4) / 10, 0, 1);

  return clamp(
    boundaryAveragePenalty * 0.35 +
      boundaryTrendPenalty * 0.25 +
      shortHistoryPenalty * 0.2 +
      volatilityPenalty * 0.2,
    0,
    0.4,
  );
}

function buildReviewReasons(features, ranked, confidenceProbability) {
  const reasons = new Set();
  const topProbability = ranked[0]?.probability ?? 0;
  const secondProbability = ranked[1]?.probability ?? 0;
  const margin = clamp(topProbability - secondProbability, 0, 1);
  const boundarySoftening = computeBoundarySoftening(features);

  if (confidenceProbability < 0.7) reasons.add("low_confidence");
  if (margin < 0.18) reasons.add("small_margin");
  if (features.scoreCount < 3) reasons.add("short_history");
  if (features.volatility >= 9.5) reasons.add("volatile_pattern");
  if (boundarySoftening >= 0.35) reasons.add("boundary_pattern");
  if (Math.abs(features.average - 55) <= 5 || Math.abs(features.predictedNext - 55) <= 5) {
    reasons.add("near_threshold");
  }
  if (
    features.slope <= -4 ||
    features.recentDelta <= -10 ||
    features.firstLastDelta <= -18 ||
    features.below40Ratio >= 0.25
  ) {
    reasons.add("sharp_decline");
  }

  return Array.from(reasons);
}

function scoreTrajectory(artifact, trajectory) {
  if (!artifact?.enabled) return null;

  const features = extractRiskFeatures(trajectory);
  const normalized = normalizeFeatures(artifact, features);
  const logits = artifact.classNames.map((_, classIndex) => {
    const weights = artifact.weights[classIndex] ?? [];
    const bias = artifact.biases[classIndex] ?? 0;
    return weights.reduce((sum, weight, featureIndex) => sum + weight * (normalized[featureIndex] ?? 0), bias);
  });

  const probabilities = softmax(applyTemperatureScaling(logits, artifact.calibrationTemperature));
  const ranked = artifact.classNames
    .map((className, index) => ({ className, probability: probabilities[index] ?? 0 }))
    .sort((left, right) => right.probability - left.probability);
  const conservatism = computeConservatism(features, ranked);
  const softenedProbabilities = blendWithUniform(probabilities, conservatism);
  const boundarySoftening = computeBoundarySoftening(features);
  const finalProbabilities = blendWithUniform(softenedProbabilities, boundarySoftening);
  const primary = ranked[0] ?? { className: "low", probability: 1 / 3 };
  const primaryProbability = finalProbabilities[artifact.classNames.indexOf(primary.className)] ?? primary.probability;
  const confidenceProbability = Math.min(Math.max(primaryProbability, 0), 1);
  const reviewReasons = buildReviewReasons(features, ranked, confidenceProbability);

  return {
    riskBand: primary.className,
    confidence: Number((confidenceProbability * 100).toFixed(2)),
    needsReview: reviewReasons.length > 0,
    reviewReasons,
  };
}

function makeTrajectory(label, rng, index) {
  const length = 1 + Math.floor(rng() * 6);
  const scores = [];

  if (label === "low") {
    let current = 76 + rng() * 14;
    for (let i = 0; i < length; i += 1) {
      current += (rng() - 0.5) * 4 + rng() * 1.5;
      scores.push(clamp(current, 60, 100));
    }
  } else if (label === "medium") {
    let current = 56 + rng() * 14;
    const downwardBias = rng() < 0.5 ? -2.5 : -0.5;
    for (let i = 0; i < length; i += 1) {
      current += downwardBias + (rng() - 0.5) * 7;
      scores.push(clamp(current, 35, 78));
    }
  } else {
    let current = 42 + rng() * 12;
    const drift = -4 - rng() * 3;
    for (let i = 0; i < length; i += 1) {
      current += drift + (rng() - 0.5) * 6;
      scores.push(clamp(current, 5, 60));
    }
    if (length >= 2 && rng() < 0.5) {
      scores[scores.length - 1] = clamp(scores[scores.length - 2] - (10 + rng() * 20), 0, 55);
    }
  }

  return {
    name: `Synthetic ${label} ${index + 1}`,
    email: null,
    studentId: `${label}-${index + 1}`,
    scores: scores.map((score, scoreIndex) => ({
      score,
      date: `2026-01-${String(scoreIndex + 1).padStart(2, "0")}`,
      assignmentTitle: `Assignment ${scoreIndex + 1}`,
    })),
  };
}

function buildSyntheticDataset({ seed, samplesPerClass }) {
  const rng = createRng(seed);
  const artifact = loadRiskModelArtifact();
  const rows = [];

  for (const label of RISK_BANDS) {
    for (let index = 0; index < samplesPerClass; index += 1) {
      const trajectory = makeTrajectory(label, rng, index);
      const prediction = scoreTrajectory(artifact, trajectory);

      rows.push({
        actualBand: label,
        predictedBand: prediction?.riskBand ?? "low",
        confidence: prediction?.confidence ?? 0,
        needsReview: prediction?.needsReview ?? false,
      });
    }
  }

  return rows;
}

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function main() {
  const seed = Number.parseInt(getArg("--seed") ?? String(DEFAULT_SEED), 10);
  const samplesPerClass = Number.parseInt(getArg("--samples-per-class") ?? String(DEFAULT_SAMPLES_PER_CLASS), 10);
  const rows = buildSyntheticDataset({
    seed: Number.isFinite(seed) ? seed : DEFAULT_SEED,
    samplesPerClass: Number.isFinite(samplesPerClass) && samplesPerClass > 0 ? samplesPerClass : DEFAULT_SAMPLES_PER_CLASS,
  });

  const summary = evaluateRiskPredictions(rows, { positiveClass: "high", binCount: 10 });
  const artifact = loadRiskModelArtifact();
  const reviewRows = rows.filter((row) => row.needsReview);
  const autoRows = rows.filter((row) => !row.needsReview);
  const autoCorrectRows = autoRows.filter((row) => row.actualBand === row.predictedBand);

  console.log(JSON.stringify({
    modelVersion: artifact.version,
    trainedAt: artifact.trainedAt,
    syntheticSeed: Number.isFinite(seed) ? seed : DEFAULT_SEED,
    samplesPerClass: Number.isFinite(samplesPerClass) && samplesPerClass > 0 ? samplesPerClass : DEFAULT_SAMPLES_PER_CLASS,
    source: "synthetic benchmark",
    metrics: {
      accuracy: summary.accuracy,
      macroPrecision: summary.macroPrecision,
      macroRecall: summary.macroRecall,
      macroF1: summary.macroF1,
      perClass: summary.perClass,
      confusionMatrix: summary.confusionMatrix,
      calibration: summary.calibration,
      confidenceCalibration: summary.confidenceCalibration,
      review: {
        rate: Number((reviewRows.length / rows.length).toFixed(4)),
        autoCoverage: Number((autoRows.length / rows.length).toFixed(4)),
        autoAccuracy: autoRows.length > 0 ? Number((autoCorrectRows.length / autoRows.length).toFixed(4)) : null,
      },
    },
  }, null, 2));

  console.log("");
  console.log(`Model version: ${artifact.version}`);
  console.log(`Synthetic seed: ${Number.isFinite(seed) ? seed : DEFAULT_SEED}`);
  console.log(`Samples per class: ${Number.isFinite(samplesPerClass) && samplesPerClass > 0 ? samplesPerClass : DEFAULT_SAMPLES_PER_CLASS}`);
  console.log(`Accuracy: ${(summary.accuracy * 100).toFixed(1)}%`);
  console.log(`Macro F1: ${(summary.macroF1 * 100).toFixed(1)}%`);
  console.log(`Confidence ECE: ${(summary.confidenceCalibration.expectedCalibrationError * 100).toFixed(2)}%`);
  console.log(`Review rate: ${((reviewRows.length / rows.length) * 100).toFixed(1)}%`);
  console.log(`Auto accuracy: ${autoRows.length > 0 ? ((autoCorrectRows.length / autoRows.length) * 100).toFixed(1) : "n/a"}%`);
}

main();
