-- Add per-item colour and per-order shipping/contact details.
-- Nullable at the DB level; "mandatory" is enforced in the checkout form.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS color TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_full_name TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address   TEXT,
  ADD COLUMN IF NOT EXISTS shipping_suburb    TEXT,
  ADD COLUMN IF NOT EXISTS shipping_state     TEXT,
  ADD COLUMN IF NOT EXISTS shipping_email     TEXT,
  ADD COLUMN IF NOT EXISTS shipping_phone     TEXT;
