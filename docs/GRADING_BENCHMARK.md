# GradeAI Grading Benchmark

This note is a small internal benchmark for the current GradeAI grading pipeline.

It is not a formal validation study.
It is not a claim that the model is unbiased, deployment-ready for high-stakes automation, or proven against a large academic gold set.
It is a practical pilot check to see whether the existing grading flow produces broadly reasonable marks on a controlled set of short submissions.
It should become the first honest evidence table you can show in pilot conversations.

## What This Benchmark Is

- one assignment type
- one rubric
- sixteen short benchmark submissions
- a manual expected score for each submission
- a simple comparison against the score returned by the existing `grade-submission` pipeline

The benchmark is meant to produce honest technical evidence, not marketing evidence.
If the model drifts, over-scores weak work, under-scores strong work, or behaves inconsistently, that should be visible here.

## Scope

The fixture lives in [`../benchmarks/database-normalisation-benchmark.json`](../benchmarks/database-normalisation-benchmark.json).

It uses a single assignment:

- title: `Database Normalisation Case Study`
- module: `CS220`
- max score: `80`

The rubric has four equal areas:

1. Functional dependency analysis
2. Normalisation and table design
3. Keys and integrity constraints
4. Justification and trade-offs

The fixture includes, for each sample:

- `submission_id`
- short answer text
- expected manual score
- expected grade band
- reason for expected score
- rubric criteria being assessed

## Ground Rules

- This benchmark does not change production grading logic.
- This benchmark does not change the UI.
- This benchmark does not change the Supabase schema.
- This repo does not auto-run paid API calls for the benchmark.
- The benchmark should only be run by a developer or reviewer who deliberately decides to send the submissions through the existing grading pipeline.

## How To Run It Through The Existing Pipeline

The safest route is to use the current app and Edge Function exactly as they already work.

### Manual workflow

1. Start from a non-production environment or a controlled pilot environment.
2. Create one assignment that matches the benchmark brief and rubric in the fixture.
3. For each sample in the fixture, create a plain text submission file using the `short_answer_text`.
4. Upload those files as student submissions against that assignment.
5. Run the normal `AI grade` flow from the assignment detail page, or invoke the existing `grade-submission` Edge Function for those submission IDs.
6. Capture the returned AI scores from the resulting grade rows.
7. Export them with the live capture script instead of hand-copying them.

### Capture script

If your benchmark submissions are uploaded with file names that match the fixture IDs, for example:

- `benchmark-dbnorm-01.txt`
- `benchmark-dbnorm-02.txt`

you can export the live benchmark rows directly from Supabase:

```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
node tools/grading-benchmark/capture-benchmark-results.mjs --assignment-id <assignment-uuid>
```

That writes:

- `benchmarks/grading-benchmark-results.run.json`

The script pulls:

- live submission IDs
- file names
- AI scores
- final scores
- grading confidence
- review timestamps

and maps them back to the fixture IDs by file name.

If there are unmatched rows, the output will tell you which submissions did not match the benchmark naming convention.

You can also run the npm alias:

```bash
npm run benchmark:grading:capture -- --assignment-id <assignment-uuid>
```

### Result file shape

The comparison script accepts either a plain JSON array like this:

```json
[
  { "submission_id": "benchmark-dbnorm-01", "ai_score": 74 },
  { "submission_id": "benchmark-dbnorm-02", "ai_score": 66 }
]
```

It also accepts `final_score` if you want to compare final reviewed marks instead of raw AI marks.

If you want a checked-in starting point, copy:

```bash
cp benchmarks/grading-benchmark-results.template.json benchmarks/grading-benchmark-results.run.json
```

and fill in the `ai_score` values after running the benchmark submissions.

The live capture script already writes a richer version of this structure, so in normal use you should prefer the generated file over hand-editing a JSON array.

### Comparison script

Run:

```bash
node tools/grading-benchmark/score-benchmark.mjs
```

That prints a blank comparison table template based on the fixture.

If you already have AI results:

```bash
node tools/grading-benchmark/score-benchmark.mjs path/to/results.json
```

That prints a populated Markdown table and a stronger summary:

- compared rows
- mean absolute error
- mean signed error
- count within 5 marks
- count within 10 marks
- exact grade-band matches
- over-scoring vs under-scoring count

## Results Table Template

Use this structure when recording a run:

| Submission ID | Expected Score | Expected Band | AI Score | AI Band | Absolute Error | Delta | Within 5 | Band Match | Notes |
| --- | ---: | --- | ---: | --- | ---: | ---: | :---: | :---: | --- |
| benchmark-dbnorm-01 | 76 | First |  |  |  |  |  |  |  |
| benchmark-dbnorm-02 | 68 | Upper Second |  |  |  |  |  |  |  |
| benchmark-dbnorm-03 | 64 | Upper Second |  |  |  |  |  |  |  |
| benchmark-dbnorm-04 | 52 | Lower Second |  |  |  |  |  |  |  |
| benchmark-dbnorm-05 | 46 | Third / Pass |  |  |  |  |  |  |  |
| benchmark-dbnorm-06 | 74 | First |  |  |  |  |  |  |  |
| benchmark-dbnorm-07 | 18 | Fail |  |  |  |  |  |  |  |
| benchmark-dbnorm-08 | 58 | Lower Second |  |  |  |  |  |  |  |
| benchmark-dbnorm-09 | 66 | Upper Second |  |  |  |  |  |  |  |
| benchmark-dbnorm-10 | 34 | Fail |  |  |  |  |  |  |  |
| benchmark-dbnorm-11 | 61 | Upper Second |  |  |  |  |  |  |  |
| benchmark-dbnorm-12 | 79 | First |  |  |  |  |  |  |  |
| benchmark-dbnorm-13 | 42 | Third / Pass |  |  |  |  |  |  |  |
| benchmark-dbnorm-14 | 56 | Lower Second |  |  |  |  |  |  |  |
| benchmark-dbnorm-15 | 12 | Fail |  |  |  |  |  |  |  |
| benchmark-dbnorm-16 | 77 | First |  |  |  |  |  |  |  |

## How To Read The Output

This benchmark is deliberately small, so you should not over-claim from it.

What it can tell you:

- whether the pipeline roughly separates strong, middling, and weak work
- whether there are obvious harsh or generous scoring patterns
- whether the same rubric seems to be applied consistently across short submissions

What it cannot tell you:

- whether the system is validated for broad institutional use
- whether the system is fair across all disciplines or student groups
- whether short benchmark performance predicts live production reliability

## Suggested Internal Interpretation

As a rough internal signal:

- many scores within `5` marks of the expected score is encouraging
- many exact grade-band matches is a stronger sign than small raw-score coincidences
- repeated misses above `10` marks need investigation
- confident high scores on clearly weak work are a stronger warning sign than small misses on middle-band work
- repeated over-scoring is a worse pilot signal than repeated slight under-scoring, because it erodes lecturer trust faster
- if the grade band is often wrong, the benchmark should be treated as a failure even if some raw scores look close

## Files Used

- [`../benchmarks/database-normalisation-benchmark.json`](../benchmarks/database-normalisation-benchmark.json)
- [`../benchmarks/grading-benchmark-results.template.json`](../benchmarks/grading-benchmark-results.template.json)
- [`../tools/grading-benchmark/capture-benchmark-results.mjs`](../tools/grading-benchmark/capture-benchmark-results.mjs)
- [`../tools/grading-benchmark/score-benchmark.mjs`](../tools/grading-benchmark/score-benchmark.mjs)
