const RISK_BANDS = ["low", "medium", "high"];

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function normalizeConfidence(value) {
  if (!Number.isFinite(value)) return 0;
  return clamp01(value > 1 ? value / 100 : value);
}

function createMatrix() {
  return Object.fromEntries(
    RISK_BANDS.map((actualBand) => [
      actualBand,
      Object.fromEntries(RISK_BANDS.map((predictedBand) => [predictedBand, 0])),
    ]),
  );
}

function createClassMetrics() {
  return Object.fromEntries(
    RISK_BANDS.map((band) => [
      band,
      {
        precision: 0,
        recall: 0,
        f1: 0,
        support: 0,
      },
    ]),
  );
}

function safeDivide(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function buildCalibrationBins(binCount) {
  return Array.from({ length: binCount }, (_, index) => ({
    lowerBound: index / binCount,
    upperBound: (index + 1) / binCount,
    count: 0,
    totalConfidence: 0,
    positives: 0,
  }));
}

function finalizeCalibrationBins(bins) {
  return bins.map((bin) => {
    const averageConfidence = safeDivide(bin.totalConfidence, bin.count);
    const observedPositiveRate = safeDivide(bin.positives, bin.count);
    return {
      lowerBound: bin.lowerBound,
      upperBound: bin.upperBound,
      count: bin.count,
      averageConfidence: Number(averageConfidence.toFixed(4)),
      observedPositiveRate: Number(observedPositiveRate.toFixed(4)),
      calibrationGap: Number(Math.abs(observedPositiveRate - averageConfidence).toFixed(4)),
    };
  });
}

function evaluateCalibration(rows, positiveFn, binCount) {
  const bins = buildCalibrationBins(binCount);
  let totalCount = 0;
  let brierTotal = 0;

  for (const row of rows) {
    const confidence = normalizeConfidence(row?.confidence ?? 0);
    const positive = positiveFn(row) ? 1 : 0;
    const binIndex = Math.min(binCount - 1, Math.floor(confidence * binCount));
    const bin = bins[binIndex];
    bin.count += 1;
    bin.totalConfidence += confidence;
    bin.positives += positive;
    totalCount += 1;
    brierTotal += (confidence - positive) ** 2;
  }

  const populatedBins = bins.filter((bin) => bin.count > 0);
  const weightedGap = populatedBins.reduce((sum, bin) => {
    const averageConfidence = safeDivide(bin.totalConfidence, bin.count);
    const observedPositiveRate = safeDivide(bin.positives, bin.count);
    return sum + Math.abs(observedPositiveRate - averageConfidence) * bin.count;
  }, 0);
  const expectedCalibrationError = safeDivide(weightedGap, populatedBins.reduce((sum, bin) => sum + bin.count, 0));

  return {
    brierScore: Number(safeDivide(brierTotal, Math.max(1, totalCount)).toFixed(4)),
    expectedCalibrationError: Number(expectedCalibrationError.toFixed(4)),
    bins: finalizeCalibrationBins(bins),
  };
}

export function evaluateRiskPredictions(rows, options = {}) {
  const positiveClass = options.positiveClass ?? "high";
  const binCount = Math.max(1, Math.floor(options.binCount ?? 10));
  const confusionMatrix = createMatrix();
  const perClass = createClassMetrics();

  let processed = 0;
  let correct = 0;

  for (const row of rows) {
    const actualBand = row?.actualBand;
    const predictedBand = row?.predictedBand;

    if (!RISK_BANDS.includes(actualBand) || !RISK_BANDS.includes(predictedBand)) {
      continue;
    }

    const confidence = normalizeConfidence(row?.confidence ?? 0);

    processed += 1;
    if (actualBand === predictedBand) correct += 1;

    confusionMatrix[actualBand][predictedBand] += 1;
  }

  for (const band of RISK_BANDS) {
    const tp = confusionMatrix[band][band];
    const fp = RISK_BANDS.filter((otherBand) => otherBand !== band)
      .reduce((sum, otherBand) => sum + confusionMatrix[otherBand][band], 0);
    const fn = RISK_BANDS.filter((otherBand) => otherBand !== band)
      .reduce((sum, otherBand) => sum + confusionMatrix[band][otherBand], 0);
    const support = tp + fn;
    const precision = safeDivide(tp, tp + fp);
    const recall = safeDivide(tp, support);
    const f1 = safeDivide(2 * precision * recall, precision + recall);

    perClass[band] = {
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4)),
      support,
    };
  }

  const macroPrecision = safeDivide(
    RISK_BANDS.reduce((sum, band) => sum + perClass[band].precision, 0),
    RISK_BANDS.length,
  );
  const macroRecall = safeDivide(
    RISK_BANDS.reduce((sum, band) => sum + perClass[band].recall, 0),
    RISK_BANDS.length,
  );
  const macroF1 = safeDivide(
    RISK_BANDS.reduce((sum, band) => sum + perClass[band].f1, 0),
    RISK_BANDS.length,
  );

  return {
    count: processed,
    accuracy: Number(safeDivide(correct, processed).toFixed(4)),
    macroPrecision: Number(macroPrecision.toFixed(4)),
    macroRecall: Number(macroRecall.toFixed(4)),
    macroF1: Number(macroF1.toFixed(4)),
    perClass,
    confusionMatrix,
    calibration: {
      positiveClass,
      ...evaluateCalibration(rows, (row) => row?.actualBand === positiveClass, binCount),
    },
    confidenceCalibration: {
      positiveClass: "correct",
      ...evaluateCalibration(rows, (row) => row?.actualBand === row?.predictedBand, binCount),
    },
  };
}
