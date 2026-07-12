-- Discount codes: date-boxed, optionally usage-capped codes applied at checkout.

CREATE TABLE public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  max_uses INTEGER,
  times_used INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT discount_codes_percentage_max CHECK (discount_type != 'percentage' OR discount_value <= 100),
  CONSTRAINT discount_codes_valid_range CHECK (valid_until > valid_from)
);

CREATE UNIQUE INDEX discount_codes_code_upper_idx ON public.discount_codes (UPPER(code));

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage discount codes"
ON public.discount_codes
FOR ALL
USING (public.get_my_role() IN ('admin', 'sales_admin'))
WITH CHECK (public.get_my_role() IN ('admin', 'sales_admin'));

CREATE TRIGGER update_discount_codes_updated_at
BEFORE UPDATE ON public.discount_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- orders gains columns to record which code (if any) was applied
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Shared validation: looks up a code case-insensitively, locks its row
-- (both callers below rely on this lock — see redeem_discount_code), and
-- checks it's currently usable. Returns the matched row's id plus the
-- computed discount amount for the given subtotal, or raises a
-- descriptive exception.
CREATE OR REPLACE FUNCTION public._validate_discount_code(p_code TEXT, p_subtotal NUMERIC)
RETURNS TABLE (
  id UUID,
  discount_type TEXT,
  discount_value NUMERIC,
  discount_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dc RECORD;
  computed_amount NUMERIC;
BEGIN
  SELECT * INTO dc
  FROM public.discount_codes
  WHERE UPPER(code) = UPPER(p_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Discount code not found';
  END IF;

  IF NOT dc.is_active THEN
    RAISE EXCEPTION 'Discount code is no longer active';
  END IF;

  IF now() < dc.valid_from OR now() > dc.valid_until THEN
    RAISE EXCEPTION 'Discount code has expired';
  END IF;

  IF dc.max_uses IS NOT NULL AND dc.times_used >= dc.max_uses THEN
    RAISE EXCEPTION 'Discount code has reached its usage limit';
  END IF;

  IF dc.discount_type = 'percentage' THEN
    computed_amount := round(p_subtotal * dc.discount_value / 100, 2);
  ELSE
    computed_amount := least(dc.discount_value, p_subtotal);
  END IF;

  RETURN QUERY SELECT dc.id, dc.discount_type, dc.discount_value, computed_amount;
END;
$$;

-- Read-only preview — used by the "Apply" button at checkout. The FOR
-- UPDATE lock taken inside _validate_discount_code is released as soon as
-- this function's own (single-statement) transaction ends, so this is
-- safe to call repeatedly without blocking other customers.
CREATE OR REPLACE FUNCTION public.check_discount_code(p_code TEXT, p_subtotal NUMERIC)
RETURNS TABLE (
  discount_type TEXT,
  discount_value NUMERIC,
  discount_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT v.discount_type, v.discount_value, v.discount_amount
  FROM public._validate_discount_code(p_code, p_subtotal) v;
END;
$$;

-- Atomic redemption — called by order creation immediately before the
-- order row is inserted. The lock taken inside _validate_discount_code
-- is held for the remainder of this function's transaction, so the
-- increment below is race-safe against a concurrent redemption of the
-- same code. Raises (aborting order creation) if the code is no longer
-- valid at this point, even if an earlier preview said it was.
CREATE OR REPLACE FUNCTION public.redeem_discount_code(p_code TEXT, p_subtotal NUMERIC)
RETURNS TABLE (
  discount_type TEXT,
  discount_value NUMERIC,
  discount_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
BEGIN
  SELECT * INTO v FROM public._validate_discount_code(p_code, p_subtotal);

  UPDATE public.discount_codes
  SET times_used = times_used + 1
  WHERE id = v.id;

  RETURN QUERY SELECT v.discount_type, v.discount_value, v.discount_amount;
END;
$$;
