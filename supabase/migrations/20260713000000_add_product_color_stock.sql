-- Per-colour stock: one row per (product, disambiguated colour label — the
-- same label already stored in order_items.color, e.g. "Pink", "Multi 1").
-- Colourless products keep using products.stock_quantity unchanged; a
-- colour with no row here is treated as in-stock until admin sets one.

CREATE TABLE public.product_color_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, color)
);

ALTER TABLE public.product_color_stock ENABLE ROW LEVEL SECURITY;

-- Public read — the storefront needs this to render Sold Out states,
-- same posture as "Products are viewable by everyone".
CREATE POLICY "Product colour stock is viewable by everyone"
ON public.product_color_stock
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage product colour stock"
ON public.product_color_stock
FOR ALL
USING (public.get_my_role() IN ('admin', 'sales_admin'))
WITH CHECK (public.get_my_role() IN ('admin', 'sales_admin'));

CREATE TRIGGER update_product_color_stock_updated_at
BEFORE UPDATE ON public.product_color_stock
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Rewrite the approval trigger to try a per-colour row first, falling
-- back to product-level stock (colourless products, or a colour with no
-- row set up yet). Same lock-check-decrement-or-raise pattern as before,
-- just colour-scoped when a matching row exists.
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
  color_stock_id UUID;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    FOR item IN
      SELECT product_id, quantity, color
      FROM public.order_items
      WHERE order_id = NEW.id
    LOOP
      SELECT id, stock_quantity INTO color_stock_id, current_stock
      FROM public.product_color_stock
      WHERE product_id = item.product_id AND color = item.color
      FOR UPDATE;

      IF FOUND THEN
        SELECT name INTO prod_name FROM public.products WHERE id = item.product_id;

        IF item.quantity > current_stock THEN
          RAISE EXCEPTION 'Insufficient stock for "%" (%): need %, only % in stock', prod_name, item.color, item.quantity, current_stock;
        END IF;

        UPDATE public.product_color_stock
        SET stock_quantity = stock_quantity - item.quantity
        WHERE id = color_stock_id;
      ELSE
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
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
