-- Atomic party reassignment for billing records and payment receipts.
-- Moves only the bill and exclusive receipts. Covered CNs stay on the original party.

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

CREATE OR REPLACE FUNCTION public.fn_reassign_payment_receipt_party(
  p_receipt_id uuid,
  p_old_party_id uuid,
  p_new_party_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt public.party_payment_receipts;
  v_new_account_id uuid;
  v_new_party_name text;
  v_wrong_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  IF p_receipt_id IS NULL OR p_old_party_id IS NULL OR p_new_party_id IS NULL THEN
    RAISE EXCEPTION 'Receipt and party ids are required.';
  END IF;

  IF p_new_party_id = p_old_party_id THEN
    RAISE EXCEPTION 'New party is the same as the current party';
  END IF;

  SELECT *
  INTO v_receipt
  FROM public.party_payment_receipts
  WHERE id = p_receipt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment receipt not found';
  END IF;

  IF v_receipt.party_id IS DISTINCT FROM p_old_party_id THEN
    RAISE EXCEPTION 'Payment receipt not found';
  END IF;

  IF v_receipt.status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'Only active payment receipts can be reassigned';
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

  IF COALESCE(cardinality(v_receipt.related_billing_record_ids), 0) > 0 THEN
    SELECT COUNT(*)
    INTO v_wrong_count
    FROM public.party_billing_records pbr
    WHERE pbr.id = ANY (v_receipt.related_billing_record_ids)
      AND pbr.party_id IS DISTINCT FROM p_new_party_id;

    IF v_wrong_count > 0 THEN
      RAISE EXCEPTION '% bill(s) linked to this payment still belong to the old party. Reassign those bills to the new party first, then reassign this payment.',
        v_wrong_count
        USING ERRCODE = 'P0409';
    END IF;
  END IF;

  UPDATE public.party_payment_receipts
  SET
    party_id = p_new_party_id,
    party_ledger_account_id = v_new_account_id
  WHERE id = p_receipt_id;

  RETURN jsonb_build_object(
    'success', true,
    'receipt_id', p_receipt_id,
    'old_party_id', p_old_party_id,
    'new_party_id', p_new_party_id,
    'new_party_name', v_new_party_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_reassign_billing_record_party(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reassign_payment_receipt_party(uuid, uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
