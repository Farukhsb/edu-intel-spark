import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateRiskPredictions } from "./evaluation-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const artifactPath = resolve(repoRoot, "src/lib/riskModelArtifact.ts");

const BANDS = ["low", "medium", "high"];
const FAMILY_SIZE_PER_BAND = 30;
const STRESS_SEED = 7331;

function loadRiskModelArtifact() {
  const raw = readFileSync(artifactPath, "utf8");
  const startMarker = "export const riskModelArtifact = ";
  const endMarker = " as const satisfies RiskModelArtifact;";
  const startIndex = raw.indexOf(startMarker);
  const endIndex = raw.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error(`Unable to load risk model artifact from ${artifactPath}`);
  }

  return JSON.parse(raw.slice(startIndex + startMarker.length, endIndex).trim());
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
    volatility: stdDev,
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

function buildTrajectory(scores, family, band, index) {
  return {
    name: `${family} ${band} ${index + 1}`,
    email: null,
    studentId: `${family}-${band}-${index + 1}`.toLowerCase().replace(/\s+/g, "-"),
    scores: scores.map((score, scoreIndex) => ({
      score,
      date: `2026-03-${String(scoreIndex + 1).padStart(2, "0")}`,
      assignmentTitle: `Task ${scoreIndex + 1}`,
    })),
  };
}

function jitterSeries(baseScores, rng, spread, min = 0, max = 100) {
  return baseScores.map((score) => clamp(score + (rng() - 0.5) * spread, min, max));
}

function oscillateSeries(baseScores, rng, amplitude, drift = 0, min = 0, max = 100) {
  return baseScores.map((score, index) => {
    const wave = index % 2 === 0 ? amplitude : -amplitude;
    return clamp(score + wave + drift * index + (rng() - 0.5) * (amplitude / 2), min, max);
  });
}

function buildFamilyRows(artifact, family, rng) {
  const rows = [];

  for (const band of BANDS) {
    for (let index = 0; index < FAMILY_SIZE_PER_BAND; index += 1) {
      const base = family.buildScores(band, rng, index);
      const trajectory = buildTrajectory(base, family.name, band, index);
      const prediction = scoreTrajectory(artifact, trajectory);

      rows.push({
        actualBand: band,
        predictedBand: prediction.riskBand,
        confidence: prediction.confidence,
        needsReview: prediction.needsReview,
        family: family.name,
      });
    }
  }

  return rows;
}

function buildFamilies() {
  return [
    {
      name: "baseline",
      description: "Well-separated stable grade patterns with light noise",
      buildScores(band, rng) {
        const base = {
          low: [86, 85, 87, 86, 88],
          medium: [66, 65, 64, 63, 62],
          high: [44, 41, 39, 36, 33],
        }[band];
        return jitterSeries(base, rng, 2);
      },
    },
    {
      name: "boundary",
      description: "Cases sitting just around the class thresholds",
      buildScores(band, rng) {
        const base = {
          low: [62, 60, 59, 58, 57],
          medium: [55, 53, 52, 50, 49],
          high: [46, 44, 42, 41, 39],
        }[band];
        return jitterSeries(base, rng, 4, 0, 100);
      },
    },
    {
      name: "short-history",
      description: "Only one or two graded submissions are available",
      buildScores(band, rng) {
        const base = {
          low: [91],
          medium: [58, 55],
          high: [41, 37],
        }[band];
        return jitterSeries(base, rng, 1.5);
      },
    },
    {
      name: "volatile",
      description: "Oscillating performance with high variance",
      buildScores(band, rng) {
        const base = {
          low: [82, 78, 85, 80, 84, 81],
          medium: [63, 51, 68, 52, 66, 54],
          high: [46, 39, 47, 35, 43, 31],
        }[band];
        return oscillateSeries(base, rng, band === "low" ? 2 : band === "medium" ? 4 : 5, 0, 0, 100);
      },
    },
    {
      name: "late-shift",
      description: "Mostly stable early on, then a late drop or recovery",
      buildScores(band, rng) {
        const base = {
          low: band === "low"
            ? [84, 85, 83, 82, 80, 79]
            : band === "medium"
              ? [67, 66, 64, 62, 60, 58]
              : [47, 45, 42, 39, 36, 33],
          medium: band === "low"
            ? [81, 82, 80, 77, 69, 61]
            : band === "medium"
              ? [64, 65, 63, 61, 55, 50]
              : [44, 43, 41, 38, 34, 30],
          high: band === "low"
            ? [86, 85, 84, 78, 72, 66]
            : band === "medium"
              ? [69, 67, 65, 57, 51, 46]
              : [45, 42, 40, 35, 28, 21],
        }[band];
        return jitterSeries(base, rng, 3);
      },
    },
    {
      name: "adversarial",
      description: "Patterns that can mislead the average or the slope",
      buildScores(band, rng) {
        const base = {
          low: [89, 86, 84, 73, 68],
          medium: [54, 58, 62, 55, 49, 53],
          high: [43, 48, 44, 39, 35, 31],
        }[band];
        return oscillateSeries(base, rng, band === "low" ? 2 : band === "medium" ? 5 : 4, band === "low" ? -0.6 : band === "medium" ? -0.2 : 0.1);
      },
    },
    {
      name: "recovery",
      description: "Weak start with a visible recovery by the end",
      buildScores(band, rng) {
        const base = {
          low: [60, 66, 72, 77, 81, 84],
          medium: [44, 49, 54, 60, 65, 69],
          high: [32, 36, 41, 47, 54, 60],
        }[band];
        const spread = band === "low" ? 3 : band === "medium" ? 4 : 5;
        return jitterSeries(base, rng, spread);
      },
    },
  ];
}

function summarizeFamily(artifact, family, rng) {
  const rows = buildFamilyRows(artifact, family, rng);
  const summary = evaluateRiskPredictions(rows, { positiveClass: "high", binCount: 10 });

  const correctRows = rows.filter((row) => row.actualBand === row.predictedBand);
  const wrongRows = rows.filter((row) => row.actualBand !== row.predictedBand);
  const highConfidenceWrong = wrongRows.filter((row) => row.confidence >= 90);
  const reviewRows = rows.filter((row) => row.needsReview);
  const autoRows = rows.filter((row) => !row.needsReview);
  const autoCorrectRows = autoRows.filter((row) => row.actualBand === row.predictedBand);

  const meanConfidence = rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length;
  const meanCorrectConfidence = correctRows.length > 0
    ? correctRows.reduce((sum, row) => sum + row.confidence, 0) / correctRows.length
    : 0;
  const meanWrongConfidence = wrongRows.length > 0
    ? wrongRows.reduce((sum, row) => sum + row.confidence, 0) / wrongRows.length
    : 0;

  return {
    family: family.name,
    description: family.description,
    count: summary.count,
    accuracy: summary.accuracy,
    macroPrecision: summary.macroPrecision,
    macroRecall: summary.macroRecall,
    macroF1: summary.macroF1,
    highRiskRecall: summary.perClass.high.recall,
    confusionMatrix: summary.confusionMatrix,
    calibration: summary.calibration,
    confidenceCalibration: summary.confidenceCalibration,
    confidence: {
      mean: Number(meanConfidence.toFixed(2)),
      meanCorrect: Number(meanCorrectConfidence.toFixed(2)),
      meanWrong: Number(meanWrongConfidence.toFixed(2)),
      highConfidenceWrongRate: Number((highConfidenceWrong.length / rows.length).toFixed(4)),
    },
    review: {
      rate: Number((reviewRows.length / rows.length).toFixed(4)),
      autoCoverage: Number((autoRows.length / rows.length).toFixed(4)),
      autoAccuracy: autoRows.length > 0 ? Number((autoCorrectRows.length / autoRows.length).toFixed(4)) : null,
    },
  };
}

function main() {
  const artifact = loadRiskModelArtifact();
  const rng = createRng(STRESS_SEED);
  const families = buildFamilies();
  const familyReports = families.map((family) => summarizeFamily(artifact, family, rng));

  const aggregateRows = families.flatMap((family) =>
    buildFamilyRows(artifact, family, createRng(STRESS_SEED + family.name.length * 17)),
  );
  const aggregate = evaluateRiskPredictions(aggregateRows, { positiveClass: "high", binCount: 10 });
  const reviewRows = aggregateRows.filter((row) => row.needsReview);
  const autoRows = aggregateRows.filter((row) => !row.needsReview);
  const autoCorrectRows = autoRows.filter((row) => row.actualBand === row.predictedBand);

  const worstFamilies = [...familyReports]
    .sort((left, right) => left.accuracy - right.accuracy || right.calibration.expectedCalibrationError - left.calibration.expectedCalibrationError)
    .slice(0, 3)
    .map((family) => ({
      family: family.family,
      accuracy: family.accuracy,
      macroF1: family.macroF1,
      ece: family.calibration.expectedCalibrationError,
      highConfidenceWrongRate: family.confidence.highConfidenceWrongRate,
    }));

  console.log(JSON.stringify({
    modelVersion: artifact.version,
    trainedAt: artifact.trainedAt,
    syntheticSeed: STRESS_SEED,
    familySizePerBand: FAMILY_SIZE_PER_BAND,
    families: familyReports,
    aggregate: {
      accuracy: aggregate.accuracy,
      macroPrecision: aggregate.macroPrecision,
      macroRecall: aggregate.macroRecall,
      macroF1: aggregate.macroF1,
      confusionMatrix: aggregate.confusionMatrix,
      calibration: aggregate.calibration,
      confidenceCalibration: aggregate.confidenceCalibration,
      review: {
        rate: Number((reviewRows.length / aggregateRows.length).toFixed(4)),
        autoCoverage: Number((autoRows.length / aggregateRows.length).toFixed(4)),
        autoAccuracy: autoRows.length > 0 ? Number((autoCorrectRows.length / autoRows.length).toFixed(4)) : null,
      },
    },
    worstFamilies,
  }, null, 2));

  console.log("");
  console.log(`Model version: ${artifact.version}`);
  console.log(`Families: ${familyReports.length}`);
  console.log(`Rows evaluated: ${aggregateRows.length}`);
  console.log(`Aggregate accuracy: ${(aggregate.accuracy * 100).toFixed(1)}%`);
  console.log(`Aggregate macro F1: ${(aggregate.macroF1 * 100).toFixed(1)}%`);
  console.log(`Confidence ECE: ${(aggregate.confidenceCalibration.expectedCalibrationError * 100).toFixed(2)}%`);
  console.log(`Review rate: ${((reviewRows.length / aggregateRows.length) * 100).toFixed(1)}%`);
  console.log(`Auto accuracy: ${autoRows.length > 0 ? ((autoCorrectRows.length / autoRows.length) * 100).toFixed(1) : "n/a"}%`);
  console.log("Worst families:");
  for (const family of worstFamilies) {
    console.log(
      `- ${family.family}: accuracy ${(family.accuracy * 100).toFixed(1)}%, macro F1 ${(family.macroF1 * 100).toFixed(1)}%, ECE ${(family.ece * 100).toFixed(2)}%, high-confidence wrong ${(family.highConfidenceWrongRate * 100).toFixed(1)}%`,
    );
  }
}

main();
