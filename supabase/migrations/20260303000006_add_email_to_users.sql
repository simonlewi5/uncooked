-- Add email column to users table (IF NOT EXISTS for idempotency)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill existing users with their email from auth.users
UPDATE public.users
SET email = au.email
FROM auth.users au
WHERE public.users.id = au.id;

-- Update the handle_new_user function to include email
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
