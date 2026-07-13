-- Admins can permanently delete an order (mainly for clearing out test
-- orders). If the order was 'approved' (and therefore already decremented
-- stock), restore what it consumed before the row disappears.

CREATE POLICY "Admins can delete orders"
ON public.orders
FOR DELETE
USING (public.get_my_role() IN ('admin', 'sales_admin'));

CREATE OR REPLACE FUNCTION public.restore_stock_on_order_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  updated_rows INTEGER;
BEGIN
  IF OLD.status = 'approved' THEN
    FOR item IN
      SELECT product_id, quantity, color
      FROM public.order_items
      WHERE order_id = OLD.id
    LOOP
      UPDATE public.product_color_stock
      SET stock_quantity = stock_quantity + item.quantity
      WHERE product_id = item.product_id AND color = item.color;

      GET DIAGNOSTICS updated_rows = ROW_COUNT;

      IF updated_rows = 0 THEN
        UPDATE public.products
        SET stock_quantity = stock_quantity + item.quantity
        WHERE id = item.product_id;
      END IF;
    END LOOP;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_restore_stock_on_order_delete ON public.orders;

CREATE TRIGGER trg_restore_stock_on_order_delete
BEFORE DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.restore_stock_on_order_delete();
