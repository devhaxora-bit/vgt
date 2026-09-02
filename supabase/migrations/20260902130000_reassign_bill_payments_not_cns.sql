-- Reassignment moves only the bill + exclusive payments, not consignments.
-- Skip the CN billing_party_id match when covered_cn_nos are unchanged (party-only move).

CREATE OR REPLACE FUNCTION public.fn_validate_billing_record_integrity()
RETURNS trigger
LANGUAGE plpgsql
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
          AND c.cn_no = ANY(NEW.covered_cn_nos)
      ) matched_cns;

      IF matched_cn_count <> distinct_cn_count THEN
        RAISE EXCEPTION 'Every covered CN must belong to the same billing party and remain active.';
      END IF;
    END IF;

    IF jsonb_array_length(NEW.consignment_snapshot) <> cardinality(NEW.covered_cn_nos) THEN
      RAISE EXCEPTION 'consignment_snapshot must include one row per covered CN.';
    END IF;

    IF NEW.status = 'ACTIVE' THEN
      SELECT COALESCE(pbr.bill_ref_no, pbr.id::text)
      INTO overlapping_bill_ref
      FROM public.party_billing_records pbr
      WHERE pbr.party_id = NEW.party_id
        AND pbr.status = 'ACTIVE'
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

CREATE OR REPLACE FUNCTION public.fn_reassign_billing_record_party(
  p_bill_id uuid,
  p_old_party_id uuid,
  p_new_party_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill public.party_billing_records;
  v_new_account_id uuid;
  v_new_party_name text;
  v_payment public.party_payment_receipts;
  v_bill_ids uuid[];
  v_moved_payment_ids uuid[] := ARRAY[]::uuid[];
  v_blocked_payment_ids uuid[] := ARRAY[]::uuid[];
  v_alloc_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  IF p_new_party_id IS NULL OR p_old_party_id IS NULL OR p_bill_id IS NULL THEN
    RAISE EXCEPTION 'Bill and party ids are required.';
  END IF;

  IF p_new_party_id = p_old_party_id THEN
    RAISE EXCEPTION 'New party is the same as the current party';
  END IF;

  SELECT *
  INTO v_bill
  FROM public.party_billing_records
  WHERE id = p_bill_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billing record not found';
  END IF;

  IF v_bill.party_id IS DISTINCT FROM p_old_party_id THEN
    RAISE EXCEPTION 'Billing record not found';
  END IF;

  IF v_bill.status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'Only active billing records can be reassigned';
  END IF;

  SELECT p.name, a.id
  INTO v_new_party_name, v_new_account_id
  FROM public.parties p
  JOIN public.party_ledger_accounts a ON a.party_id = p.id
  WHERE p.id = p_new_party_id
    AND p.is_active = true;

  IF v_new_account_id IS NULL THEN
    RAISE EXCEPTION 'New party not found, is inactive, or does not have a ledger account';
  END IF;

  FOR v_payment IN
    SELECT *
    FROM public.party_payment_receipts
    WHERE status = 'ACTIVE'
      AND (
        related_billing_record_ids @> ARRAY[p_bill_id]::uuid[]
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(bill_allocations, '[]'::jsonb)) AS allocation
          WHERE NULLIF(allocation->>'billing_record_id', '')::uuid = p_bill_id
        )
      )
    FOR UPDATE
  LOOP
    v_bill_ids := COALESCE(v_payment.related_billing_record_ids, ARRAY[]::uuid[]);

    FOR v_alloc_id IN
      SELECT DISTINCT NULLIF(allocation->>'billing_record_id', '')::uuid
      FROM jsonb_array_elements(COALESCE(v_payment.bill_allocations, '[]'::jsonb)) AS allocation
      WHERE NULLIF(allocation->>'billing_record_id', '') IS NOT NULL
    LOOP
      IF v_alloc_id IS NOT NULL AND NOT (v_alloc_id = ANY (v_bill_ids)) THEN
        v_bill_ids := array_append(v_bill_ids, v_alloc_id);
      END IF;
    END LOOP;

    IF (
      SELECT COUNT(DISTINCT bill_id)
      FROM unnest(v_bill_ids) AS bill_id
      WHERE bill_id IS NOT NULL
    ) > 1 THEN
      v_blocked_payment_ids := array_append(v_blocked_payment_ids, v_payment.id);
    END IF;
  END LOOP;

  IF cardinality(v_blocked_payment_ids) > 0 THEN
    RAISE EXCEPTION '% payment receipt(s) linked to this bill also cover other bills. Reverse those payments first, then reassign the bill.',
      cardinality(v_blocked_payment_ids)
      USING ERRCODE = 'P0409';
  END IF;

  UPDATE public.party_billing_records
  SET
    party_id = p_new_party_id,
    party_ledger_account_id = v_new_account_id
  WHERE id = p_bill_id;

  FOR v_payment IN
    SELECT *
    FROM public.party_payment_receipts
    WHERE status = 'ACTIVE'
      AND (
        related_billing_record_ids @> ARRAY[p_bill_id]::uuid[]
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(bill_allocations, '[]'::jsonb)) AS allocation
          WHERE NULLIF(allocation->>'billing_record_id', '')::uuid = p_bill_id
        )
      )
  LOOP
    UPDATE public.party_payment_receipts
    SET
      party_id = p_new_party_id,
      party_ledger_account_id = v_new_account_id
    WHERE id = v_payment.id;

    v_moved_payment_ids := array_append(v_moved_payment_ids, v_payment.id);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'bill_id', p_bill_id,
    'bill_ref_no', v_bill.bill_ref_no,
    'old_party_id', p_old_party_id,
    'new_party_id', p_new_party_id,
    'new_party_name', v_new_party_name,
    'moved_payment_count', cardinality(v_moved_payment_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_reassign_billing_record_party(uuid, uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
