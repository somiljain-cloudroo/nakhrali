ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_postcode TEXT,
  ADD COLUMN IF NOT EXISTS shipping_method   TEXT,
  ADD COLUMN IF NOT EXISTS shipping_cost     NUMERIC(10,2) NOT NULL DEFAULT 0;
