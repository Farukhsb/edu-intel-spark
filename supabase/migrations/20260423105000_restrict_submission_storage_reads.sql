-- Restrict submission file reads to users who can already view the matching
-- submission row through public.submissions RLS.

DROP POLICY IF EXISTS "Users can view own submissions" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can view all submissions" ON storage.objects;
DROP POLICY IF EXISTS "Users can view authorized submission files" ON storage.objects;

CREATE POLICY "Users can view authorized submission files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'submissions'
  AND EXISTS (
    SELECT 1
    FROM public.submissions s
    WHERE s.file_url = storage.objects.name
  )
);
