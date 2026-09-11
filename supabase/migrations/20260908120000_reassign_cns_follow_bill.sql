-- Covered CNs must follow the bill on reassignment.
-- Leftover CNs on the old party were showing as open/unbilled (e.g. bill 1926).

CREATE OR REPLACE FUNCTION public.fn_reassign_billing_record_party(
  p_bill_id uuid,
  p_old_party_id uuid,
  p_new_party_id uuid,
  p_confirm_move_payments boolean DEFAULT false
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
  v_exclusive_payment_ids uuid[] := ARRAY[]::uuid[];
  v_blocked_payment_ids uuid[] := ARRAY[]::uuid[];
  v_moved_payment_ids uuid[] := ARRAY[]::uuid[];
  v_alloc_id uuid;
  v_exclusive_count integer := 0;
  v_moved_cn_count integer := 0;
  v_covered_cn_nos text[];
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
    ELSE
      v_exclusive_payment_ids := array_append(v_exclusive_payment_ids, v_payment.id);
    END IF;
  END LOOP;

  IF cardinality(v_blocked_payment_ids) > 0 THEN
    RAISE EXCEPTION '% payment receipt(s) linked to this bill also cover other bills. Reverse those payments first, then reassign the bill.',
      cardinality(v_blocked_payment_ids)
      USING ERRCODE = 'P0409';
  END IF;

  v_exclusive_count := COALESCE(cardinality(v_exclusive_payment_ids), 0);

  IF v_exclusive_count > 0 AND NOT COALESCE(p_confirm_move_payments, false) THEN
    RAISE EXCEPTION 'This bill has % linked payment(s). Confirm moving both the bill and those payments. Covered CNs move with the bill.',
      v_exclusive_count
      USING ERRCODE = 'P0409';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT trim(cn_no)
    FROM unnest(COALESCE(v_bill.covered_cn_nos, ARRAY[]::text[])) AS cn_no
    WHERE trim(cn_no) <> ''
  )
  INTO v_covered_cn_nos;

  IF COALESCE(cardinality(v_covered_cn_nos), 0) > 0 THEN
    UPDATE public.consignments
    SET billing_party_id = p_new_party_id
    WHERE trim(cn_no) = ANY (v_covered_cn_nos)
      AND cancel_cn = false
      AND deleted_at IS NULL;

    GET DIAGNOSTICS v_moved_cn_count = ROW_COUNT;
  END IF;

  UPDATE public.party_billing_records
  SET
    party_id = p_new_party_id,
    party_ledger_account_id = v_new_account_id
  WHERE id = p_bill_id;

  IF v_exclusive_count > 0 AND COALESCE(p_confirm_move_payments, false) THEN
    UPDATE public.party_payment_receipts
    SET
      party_id = p_new_party_id,
      party_ledger_account_id = v_new_account_id
    WHERE id = ANY (v_exclusive_payment_ids);

    v_moved_payment_ids := v_exclusive_payment_ids;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'bill_id', p_bill_id,
    'bill_ref_no', v_bill.bill_ref_no,
    'old_party_id', p_old_party_id,
    'new_party_id', p_new_party_id,
    'new_party_name', v_new_party_name,
    'moved_payment_count', COALESCE(cardinality(v_moved_payment_ids), 0),
    'moved_cn_count', COALESCE(v_moved_cn_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_reassign_billing_record_party(uuid, uuid, uuid, boolean) TO authenticated;

-- Block assigning a CN that is already on another party's active bill.
CREATE OR REPLACE FUNCTION public.fn_prevent_cross_party_cn_rebill()
RETURNS trigger
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS trg_prevent_cross_party_cn_rebill ON public.party_billing_records;
CREATE TRIGGER trg_prevent_cross_party_cn_rebill
  BEFORE INSERT OR UPDATE OF covered_cn_nos, status ON public.party_billing_records
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_cross_party_cn_rebill();

-- Repair leftover CNs still sitting on the old party after a bill was moved.
UPDATE public.consignments c
SET billing_party_id = latest.party_id
FROM (
  SELECT DISTINCT ON (trim(cn_no))
    trim(cn_no) AS cn_no,
    pbr.party_id
  FROM public.party_billing_records pbr
  CROSS JOIN LATERAL unnest(COALESCE(pbr.covered_cn_nos, ARRAY[]::text[])) AS cn_no
  WHERE pbr.status = 'ACTIVE'
    AND trim(cn_no) <> ''
  ORDER BY trim(cn_no), pbr.updated_at DESC NULLS LAST, pbr.created_at DESC
) latest
WHERE trim(c.cn_no) = latest.cn_no
  AND c.billing_party_id IS DISTINCT FROM latest.party_id
  AND c.cancel_cn = false
  AND c.deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
