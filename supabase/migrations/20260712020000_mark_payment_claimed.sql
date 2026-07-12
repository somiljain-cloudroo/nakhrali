-- Customers have never had an UPDATE policy on orders (only "Sales admins
-- can update orders" exists), so the checkout flow's "Done — I've made the
-- transfer" button silently failed to mark payment_status = 'paid': RLS
-- blocked the update (0 rows matched), and Postgres reports that as success
-- with nothing changed, not an error.
--
-- Rather than add a broad "customers can update their own order" policy
-- (which would let a customer edit any field on their order), this function
-- narrowly allows only the one transition a customer should ever trigger
-- themselves: marking their own order's payment as claimed.

CREATE OR REPLACE FUNCTION public.mark_payment_claimed(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET payment_status = 'paid'
  WHERE id = p_order_id
    AND (customer_id = auth.uid() OR ordered_by_contact_id = auth.uid());
END;
$$;
