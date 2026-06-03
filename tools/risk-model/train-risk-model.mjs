import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateRiskPredictions } from "./evaluation-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const artifactPath = resolve(repoRoot, "src/lib/riskModelArtifact.ts");

const FEATURE_NAMES = [
  "scoreCount",
  "average",
  "last",
  "minimum",
  "maximum",
  "slope",
  "predictedNext",
  "stdDev",
  "recent3Avg",
  "earlyAvg",
  "firstLastDelta",
  "recentDelta",
  "below50Ratio",
  "below40Ratio",
];

const CLASS_NAMES = ["low", "medium", "high"];
const EXPORT_PATH = resolve(repoRoot, "tools/risk-model/generated/risk-training-data.jsonl");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values, average) {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
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

function extractFeatures(scores) {
  const average = mean(scores);
  const last = scores[scores.length - 1] ?? 0;
  const minimum = scores.length > 0 ? Math.min(...scores) : 0;
  const maximum = scores.length > 0 ? Math.max(...scores) : 0;
  const { slope, intercept } = linearRegression(scores);
  const predictedNext = clamp(slope * scores.length + intercept, 0, 100);
  const sigma = stdDev(scores, average);
  const recent3Avg = mean(scores.slice(-3));
  const earlyAvg = mean(scores.slice(0, Math.max(1, Math.floor(scores.length / 2))));
  const firstLastDelta = scores.length > 0 ? last - (scores[0] ?? 0) : 0;
  const recentDelta = scores.length >= 2 ? last - scores[scores.length - 2] : 0;
  const below50Ratio = scores.length > 0 ? scores.filter((score) => score < 50).length / scores.length : 0;
  const below40Ratio = scores.length > 0 ? scores.filter((score) => score < 40).length / scores.length : 0;

  return [
    scores.length,
    average,
    last,
    minimum,
    maximum,
    slope,
    predictedNext,
    sigma,
    recent3Avg,
    earlyAvg,
    firstLastDelta,
    recentDelta,
    below50Ratio,
    below40Ratio,
  ];
}

function generateScores(label) {
  const length = 1 + Math.floor(Math.random() * 6);
  const scores = [];

  if (label === 0) {
    let current = 76 + Math.random() * 14;
    for (let index = 0; index < length; index += 1) {
      current += (Math.random() - 0.5) * 4 + Math.random() * 1.5;
      scores.push(clamp(current, 60, 100));
    }
    return scores;
  }

  if (label === 1) {
    let current = 56 + Math.random() * 14;
    const downwardBias = Math.random() < 0.5 ? -2.5 : -0.5;
    for (let index = 0; index < length; index += 1) {
      current += downwardBias + (Math.random() - 0.5) * 7;
      scores.push(clamp(current, 35, 78));
    }
    return scores;
  }

  let current = 42 + Math.random() * 12;
  const drift = -4 - Math.random() * 3;
  for (let index = 0; index < length; index += 1) {
    current += drift + (Math.random() - 0.5) * 6;
    scores.push(clamp(current, 5, 60));
  }
  if (length >= 2 && Math.random() < 0.5) {
    scores[scores.length - 1] = clamp(scores[scores.length - 2] - (10 + Math.random() * 20), 0, 55);
  }
  return scores;
}

function dot(left, right) {
  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    total += (left[index] ?? 0) * (right[index] ?? 0);
  }
  return total;
}

function softmax(logits) {
  const maxLogit = Math.max(...logits);
  const expValues = logits.map((value) => Math.exp(value - maxLogit));
  const denominator = expValues.reduce((sum, value) => sum + value, 0) || 1;
  return expValues.map((value) => value / denominator);
}

function scaleLogits(logits, temperature) {
  const safeTemperature = Number.isFinite(temperature) && temperature > 0 ? temperature : 1;
  return logits.map((value) => value / safeTemperature);
}

function trainModel(samples, labels) {
  const featureMeans = FEATURE_NAMES.map((_, featureIndex) =>
    mean(samples.map((sample) => sample[featureIndex] ?? 0)),
  );
  const featureStdDevs = FEATURE_NAMES.map((_, featureIndex) =>
    Math.max(
      1e-6,
      stdDev(
        samples.map((sample) => sample[featureIndex] ?? 0),
        featureMeans[featureIndex] ?? 0,
      ),
    ),
  );

  const normalizedSamples = samples.map((sample) =>
    sample.map((value, featureIndex) => (value - (featureMeans[featureIndex] ?? 0)) / (featureStdDevs[featureIndex] ?? 1)),
  );

  const weights = CLASS_NAMES.map(() => FEATURE_NAMES.map(() => 0));
  const biases = CLASS_NAMES.map(() => 0);
  const learningRate = 0.06;
  const epochs = 2500;
  const sampleCount = normalizedSamples.length;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradientWeights = CLASS_NAMES.map(() => FEATURE_NAMES.map(() => 0));
    const gradientBiases = CLASS_NAMES.map(() => 0);

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const sample = normalizedSamples[sampleIndex];
      const label = labels[sampleIndex];
      const logits = CLASS_NAMES.map((_, classIndex) => dot(weights[classIndex], sample) + biases[classIndex]);
      const probabilities = softmax(logits);

      for (let classIndex = 0; classIndex < CLASS_NAMES.length; classIndex += 1) {
        const expected = label === classIndex ? 1 : 0;
        const delta = probabilities[classIndex] - expected;
        gradientBiases[classIndex] += delta;
        for (let featureIndex = 0; featureIndex < FEATURE_NAMES.length; featureIndex += 1) {
          gradientWeights[classIndex][featureIndex] += delta * sample[featureIndex];
        }
      }
    }

    for (let classIndex = 0; classIndex < CLASS_NAMES.length; classIndex += 1) {
      biases[classIndex] -= (learningRate / sampleCount) * gradientBiases[classIndex];
      for (let featureIndex = 0; featureIndex < FEATURE_NAMES.length; featureIndex += 1) {
        weights[classIndex][featureIndex] -= (learningRate / sampleCount) * gradientWeights[classIndex][featureIndex];
      }
    }
  }

  return { featureMeans, featureStdDevs, weights, biases };
}

function accuracy(samples, labels, model) {
  let correct = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const normalized = sample.map((value, featureIndex) => (value - (model.featureMeans[featureIndex] ?? 0)) / (model.featureStdDevs[featureIndex] ?? 1));
    const logits = CLASS_NAMES.map((_, classIndex) => dot(model.weights[classIndex], normalized) + model.biases[classIndex]);
    const probabilities = softmax(logits);
    const predicted = probabilities.indexOf(Math.max(...probabilities));
    if (predicted === labels[index]) correct += 1;
  }
  return correct / samples.length;
}

function confidenceCalibrationError(samples, labels, model, temperature) {
  const rows = samples.map((sample, index) => {
    const normalized = sample.map((value, featureIndex) => (value - (model.featureMeans[featureIndex] ?? 0)) / (model.featureStdDevs[featureIndex] ?? 1));
    const logits = CLASS_NAMES.map((_, classIndex) => dot(model.weights[classIndex], normalized) + model.biases[classIndex]);
    const probabilities = softmax(scaleLogits(logits, temperature));
    const predicted = probabilities.indexOf(Math.max(...probabilities));
    return {
      actualBand: labels[index] === 1 ? "medium" : labels[index] === 2 ? "high" : "low",
      predictedBand: predicted === 1 ? "medium" : predicted === 2 ? "high" : "low",
      confidence: (probabilities[predicted] ?? 0) * 100,
    };
  });

  return evaluateRiskPredictions(rows, { positiveClass: "high", binCount: 10 }).confidenceCalibration.expectedCalibrationError;
}

function findCalibrationTemperature(samples, labels, model) {
  const candidates = [];
  for (let temperature = 0.5; temperature <= 5; temperature += 0.05) {
    candidates.push(Number(temperature.toFixed(2)));
  }

  let bestTemperature = 1;
  let bestNll = Number.POSITIVE_INFINITY;
  let bestEce = Number.POSITIVE_INFINITY;

  for (const temperature of candidates) {
    const ece = confidenceCalibrationError(samples, labels, model, temperature);
    if (ece < bestEce) {
      bestEce = ece;
      bestNll = ece;
      bestTemperature = temperature;
    }
  }

  return { bestTemperature, bestNll: bestNll };
}

function loadExportedTrainingRows() {
  if (!existsSync(EXPORT_PATH)) return [];

  const raw = readFileSync(EXPORT_PATH, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((row) => Array.isArray(row.feature_vector) && row.feature_vector.length === FEATURE_NAMES.length)
    .map((row) => ({
      sample: row.feature_vector.map((value) => Number(value) || 0),
      label: row.label_value === "medium" ? 1 : row.label_value === "high" ? 2 : 0,
    }));
}

function buildSyntheticRows() {
  const samples = [];
  const labels = [];

  for (let index = 0; index < 600; index += 1) {
    for (const label of [0, 1, 2]) {
      const scores = generateScores(label);
      samples.push(extractFeatures(scores));
      labels.push(label);
    }
  }

  return samples.map((sample, index) => ({ sample, label: labels[index] }));
}

const exportedRows = loadExportedTrainingRows();
const usingExportedRows = exportedRows.length > 0;
const shuffled = (usingExportedRows ? exportedRows : buildSyntheticRows()).slice();
for (let index = shuffled.length - 1; index > 0; index -= 1) {
  const swapIndex = Math.floor(Math.random() * (index + 1));
  [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
}

const splitIndex = Math.max(1, Math.floor(shuffled.length * 0.8));
const trainSet = shuffled.slice(0, splitIndex);
const testSet = shuffled.slice(splitIndex);

const trainedModel = trainModel(
  trainSet.map((entry) => entry.sample),
  trainSet.map((entry) => entry.label),
);

const trainAccuracy = accuracy(
  trainSet.map((entry) => entry.sample),
  trainSet.map((entry) => entry.label),
  trainedModel,
);
const testAccuracy = accuracy(
  testSet.map((entry) => entry.sample),
  testSet.map((entry) => entry.label),
  trainedModel,
);
const { bestTemperature: calibrationTemperature, bestNll: calibrationNll } = findCalibrationTemperature(
  testSet.map((entry) => entry.sample),
  testSet.map((entry) => entry.label),
  trainedModel,
);

const modelVersion = usingExportedRows ? "ml-real-v1" : "ml-bootstrap-v1";
const trainingSource = usingExportedRows ? "risk-training-data.jsonl" : "synthetic bootstrap";

const artifact = `import type { RiskModelArtifact } from "./riskModelArtifactTypes";

export const riskModelArtifact = ${JSON.stringify(
  {
    enabled: true,
    version: modelVersion,
    trainedAt: new Date().toISOString(),
    calibrationTemperature: Number(calibrationTemperature.toFixed(2)),
    featureNames: FEATURE_NAMES,
    classNames: CLASS_NAMES,
    featureMeans: trainedModel.featureMeans,
    featureStdDevs: trainedModel.featureStdDevs,
    weights: trainedModel.weights,
    biases: trainedModel.biases,
    metrics: {
      trainAccuracy: Number(trainAccuracy.toFixed(4)),
      testAccuracy: Number(testAccuracy.toFixed(4)),
      trainingExamples: trainSet.length,
      testExamples: testSet.length,
      source: trainingSource,
      calibrationTemperature: Number(calibrationTemperature.toFixed(2)),
      validationConfidenceEce: Number(calibrationNll.toFixed(4)),
    },
  },
  null,
  2,
)} as const satisfies RiskModelArtifact;
`;

mkdirSync(dirname(artifactPath), { recursive: true });
writeFileSync(artifactPath, artifact, "utf8");

console.log(`Wrote risk model artifact to ${artifactPath}`);
console.log(`Training source: ${trainingSource}`);
console.log(`Training accuracy: ${Math.round(trainAccuracy * 100)}%`);
console.log(`Test accuracy: ${Math.round(testAccuracy * 100)}%`);
console.log(`Calibration temperature: ${calibrationTemperature.toFixed(2)}`);
