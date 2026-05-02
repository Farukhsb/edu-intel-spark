# Internal Similarity Benchmark

This benchmark is a lightweight evaluation harness for the `internal_text_similarity` provider. It is meant to answer a practical question:

How well does the current detector separate obvious reuse, legitimate overlap, unrelated writing, and known weak spots such as paraphrase-heavy copying?

## What is being tested

The current provider in `supabase/functions/_shared/providers/internal-text-similarity.ts` uses:

- normalized text tokenization
- 8-word shingles
- Jaccard similarity
- a minimum 50-word threshold

That makes it a phrase-overlap detector, not a semantic plagiarism engine.

## Benchmark cases

The current labeled cases live in:

- `src/test/fixtures/internalTextSimilarityBenchmark.ts`

They cover:

1. Direct copy of substantive prose
2. Heavy paraphrase of the same incident narrative
3. Legitimate citation-heavy overlap
4. Unrelated academic content
5. Texts below the minimum word threshold

## Scoring

Each case contributes one or more checks:

- `analysisLimited` should match when thresholding is expected
- `minScore` is used for true-positive cases
- `maxScore` is used for false-positive guards and known-gap cases

The benchmark score is:

```text
passed checks / total checks
```

This is not a final institutional accuracy score. It is a compact engineering signal for regression detection and threshold tuning.

## Current interpretation rubric

- `90-100`: strong for the current benchmark set
- `75-89`: workable but still limited
- `60-74`: brittle
- `<60`: weak detector even for the benchmark set

## What a good result means

A good result here means:

- direct copying is caught strongly
- short texts are not overstated
- unrelated work stays low
- citation-heavy overlap is not wildly inflated

It does **not** mean:

- semantic paraphrase is solved
- code plagiarism is solved
- the detector can determine misconduct by itself

## Run it

From `worktrees/main-check`:

```powershell
npm run test -- src/test/internalTextSimilarityBenchmark.test.ts
```

For a broader integrity-focused check:

```powershell
npm run test -- src/test/internalTextSimilarity.test.ts src/test/internalTextSimilarityBenchmark.test.ts src/test/edgeFunctionHardening.test.ts
```
