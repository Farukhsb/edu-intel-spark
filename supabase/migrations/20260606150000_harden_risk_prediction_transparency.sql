alter table public.student_risk_predictions
  add column if not exists generated_at timestamptz not null default now(),
  add column if not exists feature_version text not null default 'trajectory-v1',
  add column if not exists confidence_score numeric(5,4) check (confidence_score >= 0 and confidence_score <= 1),
  add column if not exists calibration_metrics jsonb not null default '{}'::jsonb;

update public.student_risk_predictions
set
  generated_at = coalesce(generated_at, created_at, now()),
  feature_version = coalesce(feature_version, 'trajectory-v1'),
  calibration_metrics = coalesce(calibration_metrics, '{}'::jsonb)
where generated_at is null
   or feature_version is null
   or calibration_metrics is null;
