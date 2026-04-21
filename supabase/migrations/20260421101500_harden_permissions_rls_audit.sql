ALTER TABLE public.academic_integrity_reviews
  DROP CONSTRAINT IF EXISTS academic_integrity_reviews_review_type_check,
  DROP CONSTRAINT IF EXISTS academic_integrity_reviews_decision_check,
  DROP CONSTRAINT IF EXISTS academic_integrity_reviews_review_type_valid,
  DROP CONSTRAINT IF EXISTS academic_integrity_reviews_decision_valid;

ALTER TABLE public.academic_integrity_reviews
  ADD CONSTRAINT academic_integrity_reviews_review_type_valid CHECK (
    review_type IN (
      'ai-writing-suspicion',
      'similarity-plagiarism-suspicion',
      'baseline-deviation',
      'mixed'
    )
  ),
  ADD CONSTRAINT academic_integrity_reviews_decision_valid CHECK (
    decision IN ('pending', 'clear', 'investigate', 'misconduct-concern')
  );

DROP POLICY IF EXISTS "Lecturers can view own reviews" ON public.academic_integrity_reviews;
DROP POLICY IF EXISTS "Lecturers can insert own reviews" ON public.academic_integrity_reviews;
DROP POLICY IF EXISTS "Lecturers can update own reviews" ON public.academic_integrity_reviews;
DROP POLICY IF EXISTS "Lecturers can delete own reviews" ON public.academic_integrity_reviews;

CREATE POLICY "Lecturers can view own reviews"
  ON public.academic_integrity_reviews FOR SELECT
  TO authenticated
  USING (
    lecturer_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = submission_id
        AND a.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers can insert own reviews"
  ON public.academic_integrity_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    lecturer_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = submission_id
        AND a.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers can update own reviews"
  ON public.academic_integrity_reviews FOR UPDATE
  TO authenticated
  USING (
    lecturer_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = submission_id
        AND a.lecturer_id = auth.uid()
    )
  )
  WITH CHECK (
    lecturer_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = submission_id
        AND a.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers can delete own reviews"
  ON public.academic_integrity_reviews FOR DELETE
  TO authenticated
  USING (
    lecturer_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = submission_id
        AND a.lecturer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Lecturers can view own analytics recommendations" ON public.analytics_recommendations;
DROP POLICY IF EXISTS "Lecturers can insert own analytics recommendations" ON public.analytics_recommendations;
DROP POLICY IF EXISTS "Lecturers can update own analytics recommendations" ON public.analytics_recommendations;

CREATE POLICY "Lecturers can view own analytics recommendations"
  ON public.analytics_recommendations FOR SELECT
  TO authenticated
  USING (
    lecturer_id = auth.uid()
    AND (
      assignment_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.assignments a
        WHERE a.id = assignment_id
          AND a.lecturer_id = auth.uid()
      )
    )
  );

CREATE POLICY "Lecturers can insert own analytics recommendations"
  ON public.analytics_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (
    lecturer_id = auth.uid()
    AND (
      assignment_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.assignments a
        WHERE a.id = assignment_id
          AND a.lecturer_id = auth.uid()
      )
    )
  );

CREATE POLICY "Lecturers can update own analytics recommendations"
  ON public.analytics_recommendations FOR UPDATE
  TO authenticated
  USING (
    lecturer_id = auth.uid()
    AND (
      assignment_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.assignments a
        WHERE a.id = assignment_id
          AND a.lecturer_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    lecturer_id = auth.uid()
    AND (
      assignment_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.assignments a
        WHERE a.id = assignment_id
          AND a.lecturer_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Lecturers can view own recommendation actions" ON public.recommendation_actions;
DROP POLICY IF EXISTS "Lecturers can insert own recommendation actions" ON public.recommendation_actions;

CREATE POLICY "Lecturers can view own recommendation actions"
  ON public.recommendation_actions FOR SELECT
  TO authenticated
  USING (
    lecturer_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.analytics_recommendations ar
      WHERE ar.id = recommendation_id
        AND ar.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers can insert own recommendation actions"
  ON public.recommendation_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    lecturer_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.analytics_recommendations ar
      WHERE ar.id = recommendation_id
        AND ar.lecturer_id = auth.uid()
    )
  );

DROP FUNCTION IF EXISTS public.apply_recommendation_action(text, text, jsonb);

CREATE FUNCTION public.apply_recommendation_action(
  p_recommendation_id text,
  p_action_type text,
  p_payload jsonb default '{}'::jsonb
)
RETURNS public.analytics_recommendations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  resolved_status text;
  updated_row public.analytics_recommendations%ROWTYPE;
BEGIN
  resolved_status := CASE p_action_type
    WHEN 'review' THEN 'reviewed'
    WHEN 'dismiss' THEN 'dismissed'
    WHEN 'create_intervention' THEN 'actioned'
    ELSE NULL
  END;

  IF resolved_status IS NULL THEN
    RAISE EXCEPTION 'Unsupported recommendation action: %', p_action_type
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.analytics_recommendations ar
    WHERE ar.id = p_recommendation_id
      AND ar.lecturer_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Recommendation not found or not accessible'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.recommendation_actions (
    recommendation_id,
    lecturer_id,
    action_type,
    payload
  )
  VALUES (
    p_recommendation_id,
    auth.uid(),
    p_action_type,
    COALESCE(p_payload, '{}'::jsonb)
  );

  UPDATE public.analytics_recommendations
  SET status = resolved_status
  WHERE id = p_recommendation_id
    AND lecturer_id = auth.uid()
  RETURNING * INTO updated_row;

  RETURN updated_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_recommendation_action(text, text, jsonb) TO authenticated;

DROP POLICY IF EXISTS "Lecturers can view own interventions" ON public.student_interventions;
DROP POLICY IF EXISTS "Lecturers can insert own interventions" ON public.student_interventions;
DROP POLICY IF EXISTS "Lecturers can update own interventions" ON public.student_interventions;
DROP POLICY IF EXISTS "Lecturers can delete own interventions" ON public.student_interventions;
DROP POLICY IF EXISTS "Lecturers can view their own interventions" ON public.student_interventions;
DROP POLICY IF EXISTS "Lecturers can create their own interventions" ON public.student_interventions;
DROP POLICY IF EXISTS "Lecturers can update their own interventions" ON public.student_interventions;
DROP POLICY IF EXISTS "Lecturers can delete their own interventions" ON public.student_interventions;

CREATE POLICY "Lecturers can view own interventions"
  ON public.student_interventions FOR SELECT
  TO authenticated
  USING (
    lecturer_id = auth.uid()
    AND (
      assignment_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.assignments a
        WHERE a.id = assignment_id
          AND a.lecturer_id = auth.uid()
      )
    )
    AND (
      student_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.submissions s
        JOIN public.assignments a ON a.id = s.assignment_id
        WHERE s.student_id = student_interventions.student_id
          AND a.lecturer_id = auth.uid()
      )
    )
  );

CREATE POLICY "Lecturers can insert own interventions"
  ON public.student_interventions FOR INSERT
  TO authenticated
  WITH CHECK (
    lecturer_id = auth.uid()
    AND (
      assignment_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.assignments a
        WHERE a.id = assignment_id
          AND a.lecturer_id = auth.uid()
      )
    )
    AND (
      student_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.submissions s
        JOIN public.assignments a ON a.id = s.assignment_id
        WHERE s.student_id = student_interventions.student_id
          AND a.lecturer_id = auth.uid()
      )
    )
  );

CREATE POLICY "Lecturers can update own interventions"
  ON public.student_interventions FOR UPDATE
  TO authenticated
  USING (
    lecturer_id = auth.uid()
    AND (
      assignment_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.assignments a
        WHERE a.id = assignment_id
          AND a.lecturer_id = auth.uid()
      )
    )
    AND (
      student_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.submissions s
        JOIN public.assignments a ON a.id = s.assignment_id
        WHERE s.student_id = student_interventions.student_id
          AND a.lecturer_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    lecturer_id = auth.uid()
    AND (
      assignment_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.assignments a
        WHERE a.id = assignment_id
          AND a.lecturer_id = auth.uid()
      )
    )
    AND (
      student_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.submissions s
        JOIN public.assignments a ON a.id = s.assignment_id
        WHERE s.student_id = student_interventions.student_id
          AND a.lecturer_id = auth.uid()
      )
    )
  );

CREATE POLICY "Lecturers can delete own interventions"
  ON public.student_interventions FOR DELETE
  TO authenticated
  USING (
    lecturer_id = auth.uid()
    AND (
      assignment_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.assignments a
        WHERE a.id = assignment_id
          AND a.lecturer_id = auth.uid()
      )
    )
    AND (
      student_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.submissions s
        JOIN public.assignments a ON a.id = s.assignment_id
        WHERE s.student_id = student_interventions.student_id
          AND a.lecturer_id = auth.uid()
      )
    )
  );
