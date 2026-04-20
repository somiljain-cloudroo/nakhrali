-- Admins can view ALL products (including inactive ones).
-- Without this, the admin panel hides inactive products because the
-- public "Products are viewable by everyone" policy filters is_active = true.

CREATE POLICY "Admins can view all products"
ON public.products FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'sales_admin')
  )
);

CREATE POLICY "Admins can view all categories"
ON public.categories FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'sales_admin')
  )
);
