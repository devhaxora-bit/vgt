-- ============================================================
-- Global CN uniqueness + bill coverage (bypass branch RLS)
--
-- Branch-scoped RLS hid other branches' consignments/bills from
-- INVOKER triggers and app SELECT overlap checks, so the same CN
-- could be created/billed again from another branch.
-- ============================================================

-- 1) Numeric live uniqueness (text unique alone allows "100" vs "0100")
DO $$
DECLARE
  dup_groups integer := 0;
BEGIN
  SELECT COUNT(*)
  INTO dup_groups
  FROM (
    SELECT c.cn_no::bigint AS cn_num
    FROM public.consignments c
    WHERE c.deleted_at IS NULL
      AND c.cn_no ~ '^\d+$'
    GROUP BY c.cn_no::bigint
    HAVING COUNT(*) > 1
  ) duplicates;

  IF dup_groups > 0 THEN
    RAISE EXCEPTION
      'Cannot enforce numeric CN uniqueness: % live CN number group(s) already have duplicates (e.g. 100 vs 0100). Resolve them first.',
      dup_groups;
  END IF;
END $$;

DROP INDEX IF EXISTS public.consignments_cn_no_live_numeric_uidx;
CREATE UNIQUE INDEX consignments_cn_no_live_numeric_uidx
  ON public.consignments ((cn_no::bigint))
  WHERE deleted_at IS NULL
    AND cn_no ~ '^\d+$';

-- 2) Billing integrity: SECURITY DEFINER + GLOBAL active-bill overlap
CREATE OR REPLACE FUNCTION public.fn_validate_billing_record_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  distinct_cn_count integer := 0;
  matched_cn_count integer := 0;
  overlapping_bill_ref text;
  has_active_linked_payment boolean := false;
  normalized_vehicle_cancel_total numeric := 0;
  is_party_only_reassign boolean := false;
BEGIN
  IF NEW.covered_cn_nos IS NOT NULL THEN
    NEW.covered_cn_nos := ARRAY(
      SELECT trimmed_cn
      FROM (
        SELECT trim(cn_no) AS trimmed_cn, ord
        FROM unnest(NEW.covered_cn_nos) WITH ORDINALITY AS input(cn_no, ord)
        WHERE trim(cn_no) <> ''
      ) normalized
      ORDER BY ord
    );

    IF cardinality(NEW.covered_cn_nos) = 0 THEN
      NEW.covered_cn_nos := NULL;
    END IF;
  END IF;

  IF NEW.consignment_snapshot IS NULL THEN
    NEW.consignment_snapshot := '[]'::jsonb;
  END IF;

  IF jsonb_typeof(NEW.consignment_snapshot) <> 'array' THEN
    RAISE EXCEPTION 'consignment_snapshot must be a JSON array.';
  END IF;

  IF NEW.vehicle_cancel_items IS NULL THEN
    NEW.vehicle_cancel_items := '[]'::jsonb;
  END IF;

  IF jsonb_typeof(NEW.vehicle_cancel_items) <> 'array' THEN
    RAISE EXCEPTION 'vehicle_cancel_items must be a JSON array.';
  END IF;

  SELECT COALESCE(SUM(ROUND(COALESCE((item ->> 'charges')::numeric, 0), 2)), 0)
  INTO normalized_vehicle_cancel_total
  FROM jsonb_array_elements(NEW.vehicle_cancel_items) AS item
  WHERE COALESCE(trim(item ->> 'vehicle_no'), '') <> ''
     OR COALESCE(trim(item ->> 'from_station'), '') <> ''
     OR COALESCE(trim(item ->> 'to_station'), '') <> ''
     OR COALESCE(trim(item ->> 'cancellation_date'), '') <> ''
     OR COALESCE((item ->> 'charges')::numeric, 0) > 0;

  NEW.vehicle_cancel_charges_total := ROUND(COALESCE(normalized_vehicle_cancel_total, 0), 2);
  NEW.cn_total_amount := ROUND(COALESCE(NEW.cn_total_amount, 0), 2);
  NEW.added_other_charges_amount := ROUND(COALESCE(NEW.added_other_charges_amount, 0), 2);
  NEW.amount := ROUND(COALESCE(NEW.amount, 0), 2);

  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Billing record amount must be greater than zero.';
  END IF;

  IF ROUND(NEW.cn_total_amount + NEW.added_other_charges_amount + NEW.vehicle_cancel_charges_total, 2) <> NEW.amount THEN
    RAISE EXCEPTION 'Billing record amount must equal cn_total_amount plus added_other_charges_amount plus vehicle_cancel_charges_total.';
  END IF;

  is_party_only_reassign :=
    TG_OP = 'UPDATE'
    AND OLD.covered_cn_nos IS NOT DISTINCT FROM NEW.covered_cn_nos
    AND OLD.consignment_snapshot IS NOT DISTINCT FROM NEW.consignment_snapshot
    AND OLD.amount IS NOT DISTINCT FROM NEW.amount
    AND OLD.cn_total_amount IS NOT DISTINCT FROM NEW.cn_total_amount
    AND OLD.added_other_charges_amount IS NOT DISTINCT FROM NEW.added_other_charges_amount
    AND OLD.vehicle_cancel_items IS NOT DISTINCT FROM NEW.vehicle_cancel_items
    AND OLD.status IS NOT DISTINCT FROM NEW.status
    AND (
      OLD.party_id IS DISTINCT FROM NEW.party_id
      OR OLD.party_ledger_account_id IS DISTINCT FROM NEW.party_ledger_account_id
    );

  IF NEW.covered_cn_nos IS NULL OR cardinality(NEW.covered_cn_nos) = 0 THEN
    IF NEW.cn_total_amount <> 0 THEN
      RAISE EXCEPTION 'cn_total_amount must be zero when no covered CNs are linked.';
    END IF;

    IF jsonb_array_length(NEW.consignment_snapshot) <> 0 THEN
      RAISE EXCEPTION 'consignment_snapshot must be empty when no covered CNs are linked.';
    END IF;
  ELSE
    SELECT COUNT(*) INTO distinct_cn_count
    FROM (
      SELECT DISTINCT cn_no
      FROM unnest(NEW.covered_cn_nos) AS cn_no
    ) unique_cns;

    IF distinct_cn_count <> cardinality(NEW.covered_cn_nos) THEN
      RAISE EXCEPTION 'covered_cn_nos must not contain duplicates.';
    END IF;

    IF NOT is_party_only_reassign THEN
      SELECT COUNT(*) INTO matched_cn_count
      FROM (
        SELECT DISTINCT c.cn_no
        FROM public.consignments c
        WHERE c.billing_party_id = NEW.party_id
          AND c.cancel_cn = false
          AND c.deleted_at IS NULL
          AND c.cn_no = ANY(NEW.covered_cn_nos)
      ) matched_cns;

      IF matched_cn_count <> distinct_cn_count THEN
        RAISE EXCEPTION 'Every covered CN must belong to the same billing party and remain active.';
      END IF;
    END IF;

    IF jsonb_array_length(NEW.consignment_snapshot) <> cardinality(NEW.covered_cn_nos) THEN
      RAISE EXCEPTION 'consignment_snapshot must include one row per covered CN.';
    END IF;

    -- GLOBAL across parties and branches (must bypass RLS)
    IF NEW.status = 'ACTIVE' THEN
      SELECT COALESCE(pbr.bill_ref_no, pbr.id::text)
      INTO overlapping_bill_ref
      FROM public.party_billing_records pbr
      WHERE pbr.status = 'ACTIVE'
        AND pbr.id IS DISTINCT FROM NEW.id
        AND pbr.covered_cn_nos && NEW.covered_cn_nos
      LIMIT 1;

      IF overlapping_bill_ref IS NOT NULL THEN
        RAISE EXCEPTION 'Covered CNs are already billed on active bill %.', overlapping_bill_ref;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.party_payment_receipts ppr
      WHERE ppr.party_id = OLD.party_id
        AND ppr.status = 'ACTIVE'
        AND (
          ppr.related_billing_record_ids @> ARRAY[OLD.id]::uuid[]
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(COALESCE(ppr.bill_allocations, '[]'::jsonb)) AS allocation
            WHERE allocation ->> 'billing_record_id' = OLD.id::text
          )
        )
    )
    INTO has_active_linked_payment;

    IF has_active_linked_payment AND (
      OLD.amount IS DISTINCT FROM NEW.amount
      OR OLD.billing_date IS DISTINCT FROM NEW.billing_date
      OR OLD.billing_period_from IS DISTINCT FROM NEW.billing_period_from
      OR OLD.billing_period_to IS DISTINCT FROM NEW.billing_period_to
      OR OLD.bill_ref_no IS DISTINCT FROM NEW.bill_ref_no
      OR OLD.narration IS DISTINCT FROM NEW.narration
      OR OLD.covered_cn_nos IS DISTINCT FROM NEW.covered_cn_nos
      OR OLD.status IS DISTINCT FROM NEW.status
      OR OLD.cn_total_amount IS DISTINCT FROM NEW.cn_total_amount
      OR OLD.added_other_charges_amount IS DISTINCT FROM NEW.added_other_charges_amount
      OR OLD.vehicle_cancel_charges_total IS DISTINCT FROM NEW.vehicle_cancel_charges_total
      OR OLD.vehicle_cancel_items IS DISTINCT FROM NEW.vehicle_cancel_items
      OR OLD.consignment_snapshot IS DISTINCT FROM NEW.consignment_snapshot
    ) THEN
      RAISE EXCEPTION 'Bills with active linked payments cannot be edited or cancelled.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Cross-party/branch rebill guard also SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.fn_prevent_cross_party_cn_rebill()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  overlapping_bill_ref text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'ACTIVE' THEN
    RETURN NEW;
  END IF;

  IF NEW.covered_cn_nos IS NULL OR cardinality(NEW.covered_cn_nos) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(pbr.bill_ref_no, pbr.id::text)
  INTO overlapping_bill_ref
  FROM public.party_billing_records pbr
  WHERE pbr.status = 'ACTIVE'
    AND pbr.id IS DISTINCT FROM NEW.id
    AND pbr.covered_cn_nos && NEW.covered_cn_nos
  LIMIT 1;

  IF overlapping_bill_ref IS NOT NULL THEN
    RAISE EXCEPTION 'Covered CNs are already billed on active bill %.', overlapping_bill_ref;
  END IF;

  RETURN NEW;
END;
$$;

-- 4) App-layer RPC: find active bills covering CNs globally (bypasses RLS)
CREATE OR REPLACE FUNCTION public.find_active_bills_covering_cns(
  p_cn_nos text[],
  p_exclude_billing_record_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  bill_ref_no text,
  party_id uuid,
  covered_cn_nos text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pbr.id,
    pbr.bill_ref_no,
    pbr.party_id,
    pbr.covered_cn_nos
  FROM public.party_billing_records pbr
  WHERE pbr.status = 'ACTIVE'
    AND (
      p_exclude_billing_record_id IS NULL
      OR pbr.id IS DISTINCT FROM p_exclude_billing_record_id
    )
    AND p_cn_nos IS NOT NULL
    AND cardinality(p_cn_nos) > 0
    AND pbr.covered_cn_nos && p_cn_nos;
$$;

GRANT EXECUTE ON FUNCTION public.find_active_bills_covering_cns(text[], uuid) TO authenticated;
