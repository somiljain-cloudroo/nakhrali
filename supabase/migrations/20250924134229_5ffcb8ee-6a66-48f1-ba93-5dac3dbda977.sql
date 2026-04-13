-- Make customer_id nullable to support both individual and account orders (idempotent)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.orders ALTER COLUMN customer_id DROP NOT NULL;
  END IF;
END $$;