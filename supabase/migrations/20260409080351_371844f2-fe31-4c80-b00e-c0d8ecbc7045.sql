
-- 1. Make submissions bucket private
UPDATE storage.buckets SET public = false WHERE id = 'submissions';

-- 2. Fix storage upload policy to enforce path ownership
DROP POLICY IF EXISTS "Authenticated users can upload submissions" ON storage.objects;
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'submissions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Remove sensitive tables from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.assignments;
ALTER PUBLICATION supabase_realtime DROP TABLE public.submissions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.grades;
