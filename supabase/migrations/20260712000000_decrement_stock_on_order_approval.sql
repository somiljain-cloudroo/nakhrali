-- Atomically decrement product stock when an order is approved.
-- Fires only on the transition into 'approved'; never on reject or any
-- other status change. SECURITY DEFINER so the trigger's internal
-- reads/writes on order_items/products aren't affected by the calling
-- admin's own RLS grants.

CREATE OR REPLACE FUNCTION public.decrement_stock_on_order_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  current_stock INTEGER;
  prod_name TEXT;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    FOR item IN
      SELECT product_id, quantity
      FROM public.order_items
      WHERE order_id = NEW.id
    LOOP
      SELECT stock_quantity, name INTO current_stock, prod_name
      FROM public.products
      WHERE id = item.product_id
      FOR UPDATE;

      IF item.quantity > current_stock THEN
        RAISE EXCEPTION 'Insufficient stock for "%": need %, only % in stock', prod_name, item.quantity, current_stock;
      END IF;

      UPDATE public.products
      SET stock_quantity = stock_quantity - item.quantity
      WHERE id = item.product_id;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_stock_on_order_approval ON public.orders;

CREATE TRIGGER trg_decrement_stock_on_order_approval
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.decrement_stock_on_order_approval();
