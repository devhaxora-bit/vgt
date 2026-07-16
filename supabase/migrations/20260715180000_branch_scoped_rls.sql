-- ============================================================
-- Phase 3: Branch-scoped RLS
-- global/main → full access; branch → only own branch_code
-- Helpers are SECURITY DEFINER to avoid users-table RLS recursion.
-- ============================================================

-- ---------- Helpers ----------
CREATE OR REPLACE FUNCTION public.current_user_has_full_branch_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT lower(COALESCE(branch_access, 'global')) IN ('global', 'main')
      FROM public.users
      WHERE id = auth.uid()
        AND COALESCE(is_active, true) = true
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_branch_code()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(upper(btrim(branch_code)), '')
  FROM public.users
  WHERE id = auth.uid()
    AND COALESCE(is_active, true) = true;
$$;

CREATE OR REPLACE FUNCTION public.can_access_branch(p_branch text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.current_user_has_full_branch_access() THEN true
    WHEN public.current_user_branch_code() IS NULL THEN false
    ELSE upper(btrim(COALESCE(p_branch, ''))) = public.current_user_branch_code()
  END;
$$;

-- Bypass RLS when looking up parent branch for ledger-account policies
CREATE OR REPLACE FUNCTION public.party_branch_code(p_party_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(upper(btrim(branch_code)), '')
  FROM public.parties
  WHERE id = p_party_id;
$$;

CREATE OR REPLACE FUNCTION public.broker_branch_code(p_broker_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(upper(btrim(branch_code)), '')
  FROM public.brokers
  WHERE id = p_broker_id;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_has_full_branch_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_branch_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_branch(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.party_branch_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.broker_branch_code(uuid) TO authenticated;

-- ============================================================
-- PARTIES
-- ============================================================
DROP POLICY IF EXISTS "Allow read access to parties for authenticated users" ON public.parties;
DROP POLICY IF EXISTS "Allow authenticated users to read active or ledger-relevant parties" ON public.parties;
DROP POLICY IF EXISTS "Allow insert for admin users" ON public.parties;
DROP POLICY IF EXISTS "Allow update for admin users" ON public.parties;

CREATE POLICY "parties_select_branch"
ON public.parties
FOR SELECT TO authenticated
USING (
  public.can_access_branch(branch_code)
  AND (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM public.party_ledger_accounts pla
      WHERE pla.party_id = parties.id AND pla.opening_balance <> 0
    )
    OR EXISTS (
      SELECT 1 FROM public.party_billing_records pbr
      WHERE pbr.party_id = parties.id AND pbr.status = 'ACTIVE'
    )
    OR EXISTS (
      SELECT 1 FROM public.party_payment_receipts ppr
      WHERE ppr.party_id = parties.id AND ppr.status = 'ACTIVE'
    )
    OR EXISTS (
      SELECT 1 FROM public.consignments c
      WHERE c.billing_party_id = parties.id AND c.cancel_cn = false
    )
  )
);

CREATE POLICY "parties_insert_admin_branch"
ON public.parties
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
);

CREATE POLICY "parties_update_admin_branch"
ON public.parties
FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
)
WITH CHECK (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
);

-- ============================================================
-- BROKERS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read brokers" ON public.brokers;
DROP POLICY IF EXISTS "Admins can manage brokers" ON public.brokers;

CREATE POLICY "brokers_select_branch"
ON public.brokers
FOR SELECT TO authenticated
USING (public.can_access_branch(branch_code));

CREATE POLICY "brokers_insert_admin_branch"
ON public.brokers
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
);

CREATE POLICY "brokers_update_admin_branch"
ON public.brokers
FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
)
WITH CHECK (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
);

CREATE POLICY "brokers_delete_admin_branch"
ON public.brokers
FOR DELETE TO authenticated
USING (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
);

-- ============================================================
-- VEHICLES
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can read vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Admins can manage vehicles" ON public.vehicles;

CREATE POLICY "vehicles_select_branch"
ON public.vehicles
FOR SELECT TO authenticated
USING (public.can_access_branch(branch_code));

CREATE POLICY "vehicles_insert_admin_branch"
ON public.vehicles
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
);

CREATE POLICY "vehicles_update_admin_branch"
ON public.vehicles
FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
)
WITH CHECK (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
);

CREATE POLICY "vehicles_delete_admin_branch"
ON public.vehicles
FOR DELETE TO authenticated
USING (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
);

-- ============================================================
-- CONSIGNMENTS (CN) — scoped by booking_branch
-- ============================================================
DROP POLICY IF EXISTS "Allow read consignments for authenticated" ON public.consignments;
DROP POLICY IF EXISTS "Allow insert consignments for authenticated" ON public.consignments;
DROP POLICY IF EXISTS "Allow update consignments for authenticated" ON public.consignments;

CREATE POLICY "consignments_select_branch"
ON public.consignments
FOR SELECT TO authenticated
USING (public.can_access_branch(booking_branch));

CREATE POLICY "consignments_insert_branch"
ON public.consignments
FOR INSERT TO authenticated
WITH CHECK (public.can_access_branch(booking_branch));

CREATE POLICY "consignments_update_branch"
ON public.consignments
FOR UPDATE TO authenticated
USING (public.can_access_branch(booking_branch))
WITH CHECK (public.can_access_branch(booking_branch));

-- ============================================================
-- CHALLANS — scoped by origin_branch_code
-- ============================================================
DROP POLICY IF EXISTS "Allow read access to challans for authenticated users" ON public.challans;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.challans;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.challans;

CREATE POLICY "challans_select_branch"
ON public.challans
FOR SELECT TO authenticated
USING (public.can_access_branch(origin_branch_code));

CREATE POLICY "challans_insert_branch"
ON public.challans
FOR INSERT TO authenticated
WITH CHECK (public.can_access_branch(origin_branch_code));

CREATE POLICY "challans_update_branch"
ON public.challans
FOR UPDATE TO authenticated
USING (public.can_access_branch(origin_branch_code))
WITH CHECK (public.can_access_branch(origin_branch_code));

-- ============================================================
-- PARTY LEDGER ACCOUNTS — via party branch
-- ============================================================
DROP POLICY IF EXISTS "pla_read_auth" ON public.party_ledger_accounts;
DROP POLICY IF EXISTS "pla_insert_admin" ON public.party_ledger_accounts;
DROP POLICY IF EXISTS "pla_update_admin" ON public.party_ledger_accounts;

CREATE POLICY "pla_select_branch"
ON public.party_ledger_accounts
FOR SELECT TO authenticated
USING (public.can_access_branch(public.party_branch_code(party_id)));

CREATE POLICY "pla_insert_admin_branch"
ON public.party_ledger_accounts
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  AND public.can_access_branch(public.party_branch_code(party_id))
);

CREATE POLICY "pla_update_admin_branch"
ON public.party_ledger_accounts
FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid())
  AND public.can_access_branch(public.party_branch_code(party_id))
)
WITH CHECK (
  public.is_admin(auth.uid())
  AND public.can_access_branch(public.party_branch_code(party_id))
);

-- ============================================================
-- PARTY BILLS / PAYMENTS — direct branch_code
-- ============================================================
DROP POLICY IF EXISTS "pbr_read_auth" ON public.party_billing_records;
DROP POLICY IF EXISTS "pbr_insert_admin" ON public.party_billing_records;
DROP POLICY IF EXISTS "pbr_update_admin" ON public.party_billing_records;

CREATE POLICY "pbr_select_branch"
ON public.party_billing_records
FOR SELECT TO authenticated
USING (public.can_access_branch(branch_code));

CREATE POLICY "pbr_insert_admin_branch"
ON public.party_billing_records
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
);

CREATE POLICY "pbr_update_admin_branch"
ON public.party_billing_records
FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
)
WITH CHECK (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
);

DROP POLICY IF EXISTS "ppr_read_auth" ON public.party_payment_receipts;
DROP POLICY IF EXISTS "ppr_insert_admin" ON public.party_payment_receipts;
DROP POLICY IF EXISTS "ppr_update_admin" ON public.party_payment_receipts;

CREATE POLICY "ppr_select_branch"
ON public.party_payment_receipts
FOR SELECT TO authenticated
USING (public.can_access_branch(branch_code));

CREATE POLICY "ppr_insert_admin_branch"
ON public.party_payment_receipts
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
);

CREATE POLICY "ppr_update_admin_branch"
ON public.party_payment_receipts
FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
)
WITH CHECK (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
);

-- ============================================================
-- BROKER LEDGER ACCOUNTS — via broker branch
-- ============================================================
DROP POLICY IF EXISTS "bla_read_auth" ON public.broker_ledger_accounts;
DROP POLICY IF EXISTS "bla_insert_admin" ON public.broker_ledger_accounts;
DROP POLICY IF EXISTS "bla_update_admin" ON public.broker_ledger_accounts;

CREATE POLICY "bla_select_branch"
ON public.broker_ledger_accounts
FOR SELECT TO authenticated
USING (public.can_access_branch(public.broker_branch_code(broker_id)));

CREATE POLICY "bla_insert_admin_branch"
ON public.broker_ledger_accounts
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  AND public.can_access_branch(public.broker_branch_code(broker_id))
);

CREATE POLICY "bla_update_admin_branch"
ON public.broker_ledger_accounts
FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid())
  AND public.can_access_branch(public.broker_branch_code(broker_id))
)
WITH CHECK (
  public.is_admin(auth.uid())
  AND public.can_access_branch(public.broker_branch_code(broker_id))
);

-- ============================================================
-- BROKER CHALLAN BILLS / PAYMENTS — direct branch_code
-- ============================================================
DROP POLICY IF EXISTS "bcbr_read_auth" ON public.broker_challan_billing_records;
DROP POLICY IF EXISTS "bcbr_insert_admin" ON public.broker_challan_billing_records;
DROP POLICY IF EXISTS "bcbr_update_admin" ON public.broker_challan_billing_records;

CREATE POLICY "bcbr_select_branch"
ON public.broker_challan_billing_records
FOR SELECT TO authenticated
USING (public.can_access_branch(branch_code));

CREATE POLICY "bcbr_insert_admin_branch"
ON public.broker_challan_billing_records
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
);

CREATE POLICY "bcbr_update_admin_branch"
ON public.broker_challan_billing_records
FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
)
WITH CHECK (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
);

DROP POLICY IF EXISTS "bcpr_read_auth" ON public.broker_challan_payment_receipts;
DROP POLICY IF EXISTS "bcpr_insert_admin" ON public.broker_challan_payment_receipts;
DROP POLICY IF EXISTS "bcpr_update_admin" ON public.broker_challan_payment_receipts;

CREATE POLICY "bcpr_select_branch"
ON public.broker_challan_payment_receipts
FOR SELECT TO authenticated
USING (public.can_access_branch(branch_code));

CREATE POLICY "bcpr_insert_admin_branch"
ON public.broker_challan_payment_receipts
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
);

CREATE POLICY "bcpr_update_admin_branch"
ON public.broker_challan_payment_receipts
FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
)
WITH CHECK (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
);

-- ============================================================
-- Views: run as caller so underlying RLS applies
-- ============================================================
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER VIEW public.vw_party_ledger_summary SET (security_invoker = true)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not set security_invoker on vw_party_ledger_summary: %', SQLERRM;
  END;

  BEGIN
    EXECUTE 'ALTER VIEW public.vw_broker_challan_ledger_summary SET (security_invoker = true)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not set security_invoker on vw_broker_challan_ledger_summary: %', SQLERRM;
  END;
END $$;

COMMENT ON FUNCTION public.can_access_branch(text) IS
  'Branch RLS helper: global/main users pass; branch users only match their users.branch_code.';

NOTIFY pgrst, 'reload schema';
