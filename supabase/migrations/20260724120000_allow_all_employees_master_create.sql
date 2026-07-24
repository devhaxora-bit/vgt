-- Allow ALL active employees (main/global + branch) to INSERT parties/brokers/vehicles.
-- Branch scope is still enforced by can_access_branch():
--   - main/global employees → any branch
--   - branch employees → their own branch_code only
-- UPDATE/DELETE remain admin-only.

CREATE OR REPLACE FUNCTION public.is_active_employee(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = user_id
      AND COALESCE(is_active, true) = true
      AND lower(COALESCE(role, '')) = 'employee'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_full_access_employee(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = user_id
      AND COALESCE(is_active, true) = true
      AND lower(COALESCE(role, '')) = 'employee'
      AND lower(COALESCE(branch_access, 'global')) IN ('global', 'main')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_create_master_data(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(user_id) OR public.is_active_employee(user_id);
$$;

GRANT EXECUTE ON FUNCTION public.is_active_employee(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_full_access_employee(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_create_master_data(uuid) TO authenticated, anon;

DROP POLICY IF EXISTS "parties_insert_admin_branch" ON public.parties;
CREATE POLICY "parties_insert_admin_branch"
ON public.parties
FOR INSERT TO authenticated
WITH CHECK (
  public.can_create_master_data(auth.uid())
  AND public.can_access_branch(branch_code)
);

DROP POLICY IF EXISTS "brokers_insert_admin_branch" ON public.brokers;
CREATE POLICY "brokers_insert_admin_branch"
ON public.brokers
FOR INSERT TO authenticated
WITH CHECK (
  public.can_create_master_data(auth.uid())
  AND public.can_access_branch(branch_code)
);

DROP POLICY IF EXISTS "vehicles_insert_admin_branch" ON public.vehicles;
CREATE POLICY "vehicles_insert_admin_branch"
ON public.vehicles
FOR INSERT TO authenticated
WITH CHECK (
  public.can_create_master_data(auth.uid())
  AND public.can_access_branch(branch_code)
);
