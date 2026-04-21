DROP POLICY IF EXISTS "lecturers can view integrity reviews" ON public.academic_integrity_reviews;
DROP POLICY IF EXISTS "lecturers can insert integrity reviews" ON public.academic_integrity_reviews;
DROP POLICY IF EXISTS "lecturers can update integrity reviews" ON public.academic_integrity_reviews;

DROP FUNCTION IF EXISTS public.apply_recommendation_action(text, text, uuid, jsonb);
