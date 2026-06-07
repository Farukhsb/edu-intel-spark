# Risk Model Transparency

GradeAI treats student risk predictions as advisory signals for human review, not as automatic academic decisions.

## What each prediction stores

- `model_version`
- `feature_version`
- `generated_at`
- `prediction_date`
- `snapshot_id` as the input snapshot reference
- `risk_score`
- `confidence_score`
- `calibration_metrics`
- `reason_codes`

## How predictions should be used

- Risk scores are for lecturer review only.
- Risk predictions must not automatically change grades, progression, access, or academic status.
- Any intervention should be reviewed by a lecturer or other authorized staff member before action is taken.
- False-positive feedback is supported through `risk_feedback.feedback_type = 'false_alarm'`.
- Intervention outcomes are stored separately in `student_risk_outcomes` so the model can be evaluated against later evidence.

## Reason codes

Reason codes explain why a prediction was raised. They are intended to make the model auditable and easier to challenge.

Examples include:

- `average_below_40`
- `gradual_grade_decline`
- `steep_grade_decline`
- `predicted_next_below_40`
- `high_variance`
- `limited_history`
- `stale_data`

## Evaluation signals

The stored calibration metrics are used to show how reliable the current model artifact is:

- `trainAccuracy`
- `testAccuracy`
- `validationNll`
- `validationConfidenceEce`
- `calibrationTemperature`

These metrics are descriptive, not a guarantee that a prediction is correct for any individual student.

## Known limitations

- Risk predictions can lag behind recent student activity if the latest evidence is stale.
- Low-history students can produce noisier predictions.
- Prompted or heuristic fallback predictions are still advisory and should be reviewed carefully.
- A high risk score should be treated as a request for attention, not as an automatic sanction.
