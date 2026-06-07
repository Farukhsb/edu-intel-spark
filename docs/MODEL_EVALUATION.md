# Model Evaluation

GradeAI uses two model surfaces:

- AI-assisted grading and explanation
- student risk prediction and intervention support

Both are decision-support tools. Neither replaces lecturer judgement or institutional process.

## Evaluation Principles

- models are evaluated for usefulness, consistency, and failure behaviour
- outputs are treated as draft support until reviewed by a human
- failure should be visible and recoverable
- model quality should be described with plain metrics
- false positives are worth tracking because silent errors are expensive in academic settings

## AI-Assisted Grading Evaluation

The grading workflow is evaluated on whether it can:

- follow the rubric structure
- produce parseable output
- avoid partial grades when the provider fails
- keep AI output as a draft recommendation
- require lecturer review before student release
- handle missing rubrics, malformed rubrics, empty submissions, and prompt-injection style content safely

Current evidence for the grading workflow comes from:

- [`../src/test/submissionStage.test.ts`](../src/test/submissionStage.test.ts)
- [`../src/test/gradeSubmissionPrompting.test.ts`](../src/test/gradeSubmissionPrompting.test.ts)
- [`../src/test/gradeAiResponse.test.ts`](../src/test/gradeAiResponse.test.ts)

## Risk Model Evaluation

Risk predictions are evaluated with internal calibration and feedback metadata.

Stored evaluation fields include:

- `model_version`
- `feature_version`
- `generated_at`
- `prediction_date`
- `confidence_score`
- `calibration_metrics`
- `reason_codes`
- input snapshot references

Useful metrics are tracked so the model can be explained and challenged:

- `trainAccuracy`
- `testAccuracy`
- `validationNll`
- `validationConfidenceEce`
- `calibrationTemperature`

The model also supports:

- false-positive feedback
- intervention outcome tracking
- stale-data reasoning
- advisory-only handling

## What The Evaluation Can Tell Us

The evaluation can show whether the model:

- produces stable, reviewable outputs
- carries enough metadata for audit and debugging
- keeps false positives visible
- remains advisory rather than punitive
- performs well enough to support lecturer review

It does not prove that any single prediction is correct.

## Known Limits

- low-history students can be harder to score reliably
- stale data can reduce relevance
- confidence values do not guarantee correctness
- a good aggregate benchmark does not remove the need for lecturer review
- internal validation is not the same as external institutional sign-off

## Evidence Links

- [`risk-model-transparency.md`](risk-model-transparency.md)
- [`../src/test/studentRisk.test.ts`](../src/test/studentRisk.test.ts)
- [`../src/test/riskModel.test.ts`](../src/test/riskModel.test.ts)
- [`../src/test/riskModelPipeline.test.ts`](../src/test/riskModelPipeline.test.ts)
- [`../src/test/riskIntelligenceData.test.ts`](../src/test/riskIntelligenceData.test.ts)
- [`../docs/GRADING_BENCHMARK.md`](GRADING_BENCHMARK.md)

## Reviewer Note

Model evaluation is evidence of responsible design and testing, not a claim of formal certification.
