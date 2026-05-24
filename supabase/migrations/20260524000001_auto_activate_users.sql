-- Users are now auto-activated on sign-up — no admin approval required.

-- Set default to true for new profiles
ALTER TABLE public.profiles
  ALTER COLUMN is_active SET DEFAULT true;

-- Update the auth trigger to create profiles with is_active = true
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, contact_type, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'customer',
    'primary',
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Activate any existing users who were stuck in pending state
UPDATE public.profiles
SET is_active = true
WHERE is_active = false
  AND role = 'customer';
