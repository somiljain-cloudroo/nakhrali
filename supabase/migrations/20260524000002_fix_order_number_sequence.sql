-- generate_order_number() was using COUNT(*) under RLS, so each customer
-- saw only their own orders → always got SO-YYYY-0001 → unique constraint conflict.
-- Fix: use a dedicated sequence (collision-safe) and SECURITY DEFINER (bypasses RLS).

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq
  START WITH 1000
  INCREMENT BY 1
  NO CYCLE;

-- Advance the sequence past any existing orders to avoid collisions
SELECT setval(
  'public.order_number_seq',
  GREATEST(1000, (SELECT COUNT(*) + 999 FROM public.orders))
);

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'SO-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('order_number_seq')::TEXT, 4, '0');
END;
$$;
