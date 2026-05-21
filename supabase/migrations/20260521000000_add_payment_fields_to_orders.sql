-- Add payment tracking fields to orders table
-- and extend the status check constraint to include 'pending_payment'

-- 1. Add new columns (safe to run even if they already exist)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'pending';

-- 2. Add CHECK constraint on payment_status
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN ('unpaid', 'pending_payment', 'paid', 'failed', 'refunded'));

-- 3. Drop the existing orders status check and recreate it with 'pending_payment' added
--    The original constraint name is orders_status_check (verify via \d public.orders if unsure).
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
    CHECK (status IN (
      'pending',
      'pending_payment',
      'approved',
      'rejected',
      'processing',
      'shipped',
      'delivered',
      'cancelled'
    ));
