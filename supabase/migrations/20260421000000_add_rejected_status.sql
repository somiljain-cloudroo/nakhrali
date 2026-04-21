-- Add 'rejected' to the orders status check constraint.
-- The inline CHECK has a system-generated name — drop by finding it first,
-- then recreate with rejected included.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'shipped', 'delivered', 'cancelled'));
