-- Drop the recursive policies that cause infinite loops
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- Security-definer function to get current user's role without triggering RLS
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Re-create the policies using the function (no recursion)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  public.get_my_role() IN ('admin', 'sales_admin')
);

CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (
  public.get_my_role() IN ('admin', 'sales_admin')
);
