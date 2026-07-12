-- One-off data fix: order SO-2026-1015's customer clicked "Done — I've made
-- the transfer" before the mark_payment_claimed fix shipped, so the update
-- was silently blocked by RLS and payment_status stayed 'unpaid' even
-- though the transfer was actually completed. Correcting it here.

UPDATE public.orders
SET payment_status = 'paid'
WHERE order_number = 'SO-2026-1015';
