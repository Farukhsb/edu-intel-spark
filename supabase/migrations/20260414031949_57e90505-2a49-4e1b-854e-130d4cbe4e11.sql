ALTER TABLE public.academic_integrity_reviews
  ADD CONSTRAINT uq_air_submission_lecturer UNIQUE (submission_id, lecturer_id);