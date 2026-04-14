-- Create storage bucket for uploaded resumes.
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for user-scoped resume objects: resumes/<auth.uid()>/...
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can read own resume files'
  ) THEN
    CREATE POLICY "Users can read own resume files"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'resumes'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload own resume files'
  ) THEN
    CREATE POLICY "Users can upload own resume files"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'resumes'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can update own resume files'
  ) THEN
    CREATE POLICY "Users can update own resume files"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'resumes'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'resumes'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete own resume files'
  ) THEN
    CREATE POLICY "Users can delete own resume files"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'resumes'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END
$$;