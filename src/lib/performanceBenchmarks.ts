export interface PerformanceBenchmarkResult {
  label: string;
  iterations: number;
  minMs: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

export const runPerformanceBenchmark = ({
  label,
  iterations,
  run,
}: {
  label: string;
  iterations: number;
  run: () => void;
}): PerformanceBenchmarkResult => {
  const samples: number[] = [];

  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const total = samples.reduce((sum, sample) => sum + sample, 0);
  const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);

  return {
    label,
    iterations,
    minMs: round(sorted[0] ?? 0),
    avgMs: round(total / Math.max(samples.length, 1)),
    p95Ms: round(sorted[p95Index] ?? 0),
    maxMs: round(sorted[sorted.length - 1] ?? 0),
  };
};
